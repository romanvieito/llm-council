const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

function sseEvent(res, payload) {
  // Frontend expects lines like: `data: {json}\n`
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function parseRankingFromText(rankingText) {
  if (!rankingText) return [];

  const marker = 'FINAL RANKING:';
  const text = String(rankingText);

  if (text.includes(marker)) {
    const parts = text.split(marker);
    const rankingSection = parts.slice(1).join(marker);

    // Prefer numbered list like "1. Response A"
    const numberedMatches = rankingSection.match(/\d+\.\s*Response [A-Z]/g);
    if (numberedMatches && numberedMatches.length > 0) {
      return numberedMatches
        .map((m) => {
          const match = m.match(/Response [A-Z]/);
          return match ? match[0] : null;
        })
        .filter(Boolean);
    }

    // Fallback: any "Response X" occurrences
    const matches = rankingSection.match(/Response [A-Z]/g);
    return matches || [];
  }

  // Fallback: any "Response X" occurrences
  const matches = text.match(/Response [A-Z]/g);
  return matches || [];
}

function calculateAggregateRankings(stage2Results, labelToModel) {
  const positionsByModel = new Map(); // model -> [positions]

  for (const ranking of stage2Results || []) {
    const parsed = parseRankingFromText(ranking?.ranking || '');
    parsed.forEach((label, idx) => {
      const model = labelToModel?.[label];
      if (!model) return;
      const arr = positionsByModel.get(model) || [];
      arr.push(idx + 1);
      positionsByModel.set(model, arr);
    });
  }

  const aggregate = [];
  for (const [model, positions] of positionsByModel.entries()) {
    if (!positions || positions.length === 0) continue;
    const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
    aggregate.push({
      model,
      average_rank: Math.round(avg * 100) / 100,
      rankings_count: positions.length,
    });
  }

  aggregate.sort((a, b) => a.average_rank - b.average_rank);
  return aggregate;
}

async function queryOpenRouter({ apiKey, model, messages, timeoutMs = 120_000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `OpenRouter error (${resp.status})`);
    }

    const data = await resp.json();
    const message = data?.choices?.[0]?.message;
    return {
      content: message?.content ?? '',
      reasoning_details: message?.reasoning_details,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function queryModelsParallel({ apiKey, models, messages, timeoutMs }) {
  const entries = await Promise.allSettled(
    (models || []).map(async (m) => {
      const r = await queryOpenRouter({ apiKey, model: m, messages, timeoutMs });
      return [m, r];
    })
  );

  const out = new Map();
  for (const e of entries) {
    if (e.status === 'fulfilled') {
      const [model, resp] = e.value;
      out.set(model, resp);
    }
  }
  return out;
}

export default async function handler(req, res) {
  // CORS + SSE headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-OpenRouter-Api-Key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // SSE response
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  try {
    const apiKey = req.headers['x-openrouter-api-key'];
    if (!apiKey) {
      sseEvent(res, { type: 'error', message: 'Missing X-OpenRouter-Api-Key header' });
      res.end();
      return;
    }

    const body = req.body || {};
    const content = String(body.content || '').trim();
    if (!content) {
      sseEvent(res, { type: 'error', message: 'content cannot be empty' });
      res.end();
      return;
    }

    const modelCfg = body.model_config || body.model_cfg || {};
    const councilModels =
      (Array.isArray(modelCfg.council_models) && modelCfg.council_models.length > 0
        ? modelCfg.council_models
        : [
            'x-ai/grok-4.1-fast',
            'openai/gpt-5.2-chat',
            'anthropic/claude-haiku-4.5',
            'google/gemini-3-flash-preview',
          ]).slice(0, 10);
    const chairmanModel =
      (typeof modelCfg.chairman_model === 'string' && modelCfg.chairman_model) ||
      'openai/gpt-5.2-chat';

    // Conversation context (Stage 3-only history is built client-side)
    const rawConversationContext = body.conversation_context;
    let conversationContext = [];
    if (rawConversationContext != null) {
      if (!Array.isArray(rawConversationContext)) {
        sseEvent(res, { type: 'error', message: 'conversation_context must be a list' });
        res.end();
        return;
      }

      const maxTotalChars = 25_000; // allow some buffer over frontend limit
      const maxMessageChars = 5_000;
      let totalChars = 0;

      for (let i = 0; i < rawConversationContext.length; i++) {
        const msg = rawConversationContext[i];
        if (!msg || typeof msg !== 'object') {
          sseEvent(res, { type: 'error', message: `conversation_context[${i}] must be an object` });
          res.end();
          return;
        }

        const role = msg.role;
        const c = msg.content;

        if (role !== 'user' && role !== 'assistant') {
          sseEvent(res, { type: 'error', message: `conversation_context[${i}] role must be 'user' or 'assistant'` });
          res.end();
          return;
        }

        if (typeof c !== 'string' || !c.trim()) {
          sseEvent(res, { type: 'error', message: `conversation_context[${i}] content must be non-empty string` });
          res.end();
          return;
        }

        if (c.length > maxMessageChars) {
          sseEvent(res, { type: 'error', message: `conversation_context[${i}] content too large (max ${maxMessageChars} chars)` });
          res.end();
          return;
        }

        totalChars += c.length;
        if (totalChars > maxTotalChars) {
          sseEvent(res, { type: 'error', message: `conversation_context total content too large (max ${maxTotalChars} chars)` });
          res.end();
          return;
        }

        // Normalize shape to avoid passing unexpected keys downstream
        conversationContext.push({ role, content: c });
      }
    }

    const isFirstMessage = !!body.is_first_message;

    // Stage 1: individual responses
    sseEvent(res, { type: 'stage1_start' });
    const stage1Map = await queryModelsParallel({
      apiKey,
      models: councilModels,
      messages: [...conversationContext, { role: 'user', content }],
      timeoutMs: 120_000,
    });
    const stage1Results = [];
    for (const [model, resp] of stage1Map.entries()) {
      stage1Results.push({ model, response: resp?.content ?? '' });
    }
    sseEvent(res, { type: 'stage1_complete', data: stage1Results });

    // If all failed, stop.
    if (stage1Results.length === 0) {
      sseEvent(res, {
        type: 'error',
        message: 'All models failed to respond. Please try again.',
      });
      res.end();
      return;
    }

    // Stage 2: rankings
    sseEvent(res, { type: 'stage2_start' });
    const labels = stage1Results.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
    const labelToModel = {};
    labels.forEach((label, i) => {
      labelToModel[`Response ${label}`] = stage1Results[i].model;
    });
    const responsesText = labels
      .map((label, i) => `Response ${label}:\n${stage1Results[i].response}`)
      .join('\n\n');

    const rankingPrompt = `You are evaluating different responses to the following question:\n\nQuestion: ${content}\n\nHere are the responses from different models (anonymized):\n\n${responsesText}\n\nYour task:\n1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.\n2. Then, at the very end of your response, provide a final ranking.\n\nIMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:\n- Start with the line \"FINAL RANKING:\" (all caps, with colon)\n- Then list the responses from best to worst as a numbered list\n- Each line should be: number, period, space, then ONLY the response label (e.g., \"1. Response A\")\n- Do not add any other text or explanations in the ranking section\n\nNow provide your evaluation and ranking:`;

    const stage2Map = await queryModelsParallel({
      apiKey,
      models: councilModels,
      messages: [...conversationContext, { role: 'user', content: rankingPrompt }],
      timeoutMs: 120_000,
    });

    const stage2Results = [];
    for (const [model, resp] of stage2Map.entries()) {
      const ranking = resp?.content ?? '';
      stage2Results.push({
        model,
        ranking,
        parsed_ranking: parseRankingFromText(ranking),
      });
    }

    const aggregateRankings = calculateAggregateRankings(stage2Results, labelToModel);

    sseEvent(res, {
      type: 'stage2_complete',
      data: stage2Results,
      metadata: { label_to_model: labelToModel, aggregate_rankings: aggregateRankings },
    });

    // Stage 3: final synthesis
    sseEvent(res, { type: 'stage3_start' });
    const stage1Text = stage1Results
      .map((r) => `Model: ${r.model}\nResponse: ${r.response}`)
      .join('\n\n');
    const stage2Text = stage2Results
      .map((r) => `Model: ${r.model}\nRanking: ${r.ranking}`)
      .join('\n\n');

    const chairmanPrompt = `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.\n\nOriginal Question: ${content}\n\nSTAGE 1 - Individual Responses:\n${stage1Text}\n\nSTAGE 2 - Peer Rankings:\n${stage2Text}\n\nYour task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:\n- The individual responses and their insights\n- The peer rankings and what they reveal about response quality\n- Any patterns of agreement or disagreement\n\nProvide a clear, well-reasoned final answer that represents the council's collective wisdom:`;

    let stage3;
    try {
      const resp = await queryOpenRouter({
        apiKey,
        model: chairmanModel,
        messages: [...conversationContext, { role: 'user', content: chairmanPrompt }],
        timeoutMs: 120_000,
      });
      stage3 = { model: chairmanModel, response: resp?.content ?? '' };
    } catch (e) {
      stage3 = { model: chairmanModel, response: 'Error: Unable to generate final synthesis.' };
    }

    sseEvent(res, { type: 'stage3_complete', data: stage3 });

    // Optional title generation (fast) - only for first message
    if (isFirstMessage) {
      try {
        const titlePrompt = `Generate a very short title (3-5 words maximum) that summarizes the following question.\nThe title should be concise and descriptive. Do not use quotes or punctuation in the title.\n\nQuestion: ${content}\n\nTitle:`;
        const titleResp = await queryOpenRouter({
          apiKey,
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: titlePrompt }],
          timeoutMs: 30_000,
        });
        const title = String(titleResp?.content ?? 'New Conversation')
          .trim()
          .replace(/^["']|["']$/g, '')
          .slice(0, 50);
        sseEvent(res, { type: 'title_complete', data: { title: title || 'New Conversation' } });
      } catch {
        // ignore
      }
    }

    sseEvent(res, { type: 'complete' });
    res.end();
  } catch (e) {
    sseEvent(res, { type: 'error', message: String(e?.message || e) });
    res.end();
  }
}


