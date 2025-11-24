import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'conversations');

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    // Extract conversation ID from URL path
    // req.url is the pathname (e.g., '/api/conversations/123/message/stream')
    const urlPath = req.url.split('?')[0]; // Remove query string if present
    const pathParts = urlPath.split('/');
    const conversationId = pathParts[pathParts.length - 3]; // -3 because last parts are 'message/stream'
    const { content } = req.body;

    try {
      const filePath = path.join(DATA_DIR, `${conversationId}.json`);

      if (!fs.existsSync(filePath)) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Conversation not found' })}\n\n`);
        res.end();
        return;
      }

      // Load existing conversation
      const conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Check if this is the first message to generate a title
      const isFirstMessage = conversation.messages.length === 0;

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: content
      });

      // Save conversation with user message
      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));

      // Send mock streaming events
      const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      // Simulate the 3-stage process
      sendEvent('stage1_start');
      setTimeout(() => {
        const stage1Data = {
          responses: [
            {
              model: 'openai/gpt-5.1',
              response: 'This is a mock response from the LLM Council. In production, this would contain the actual individual model responses from OpenAI GPT-5.1.'
            },
            {
              model: 'google/gemini-3-pro-preview',
              response: 'Mock response from Google Gemini 3.0 Pro Preview. The real implementation would process your query through multiple LLMs simultaneously.'
            },
            {
              model: 'anthropic/claude-sonnet-4.5',
              response: 'Mock response from Anthropic Claude Sonnet 4.5. Each model would provide its unique perspective and expertise on your question.'
            },
            {
              model: 'x-ai/grok-4',
              response: 'Mock response from xAI Grok-4. The council would then rank and synthesize these responses into a comprehensive final answer.'
            }
          ]
        };

        sendEvent('stage1_complete', { data: stage1Data });

        sendEvent('stage2_start');
        setTimeout(() => {
          const stage2Data = {
            rankings: [
              {
                model: 'openai/gpt-5.1',
                ranking: 'Response A (OpenAI): Comprehensive and well-structured analysis with practical solutions. Response B (Google): Good coverage of key points with real examples. Response C (Anthropic): Concise but lacks implementation details. Response D (xAI): Solid foundation but could be more specific.',
                parsed_ranking: ['Response A', 'Response B', 'Response D', 'Response C']
              },
              {
                model: 'google/gemini-3-pro-preview',
                ranking: 'Response B: Best overall balance of depth, examples, and accessibility. Response A: Very thorough but lengthy. Response D: Good structure with concrete examples. Response C: Too brief for such a complex topic.',
                parsed_ranking: ['Response B', 'Response A', 'Response D', 'Response C']
              }
            ]
          };

          const metadata = {
            label_to_model: {
              'Response A': 'openai/gpt-5.1',
              'Response B': 'google/gemini-3-pro-preview',
              'Response C': 'anthropic/claude-sonnet-4.5',
              'Response D': 'x-ai/grok-4'
            },
            aggregate_rankings: {
              'Response B': 2,
              'Response A': 3,
              'Response D': 4,
              'Response C': 6
            }
          };

          sendEvent('stage2_complete', { data: stage2Data, metadata });

          sendEvent('stage3_start');
          setTimeout(() => {
            const stage3Data = {
              model: 'google/gemini-3-pro-preview',
              response: 'This is a mock final synthesis from the LLM Council Chairman. In production, this would be a carefully crafted response that combines the best insights from all council members, considering their peer rankings and individual expertise. The Chairman would resolve any conflicts, eliminate redundancies, and present a coherent, comprehensive answer to your query. This streaming implementation saves all messages to the file system for persistence across serverless invocations.'
            };

            sendEvent('stage3_complete', { data: stage3Data });

            // Update title if this was the first message
            if (isFirstMessage) {
              conversation.title = `Discussion: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`;
              sendEvent('title_complete', { data: { title: conversation.title } });
            }

            // Save complete assistant message to conversation
            conversation.messages.push({
              role: 'assistant',
              stage1: stage1Data.responses,
              stage2: stage2Data.rankings,
              stage3: stage3Data
            });

            fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));

            sendEvent('complete');
            res.end();
          }, 500);
        }, 500);
      }, 500);

    } catch (error) {
      console.error('Error processing streaming message:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to process message' })}\n\n`);
      res.end();
    }

    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
