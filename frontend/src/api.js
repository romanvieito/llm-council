/**
 * API client for the LLM Council backend.
 */

import { getOpenRouterKey, getModelConfig } from './localStore';

// Prefer relative API base (works with Vite dev proxy and same-origin deployments).
const API_BASE = import.meta?.env?.VITE_API_BASE || '';

export const api = {
  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - Local conversation id (frontend-owned)
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {object} options - { isFirstMessage?: boolean }
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent, options = {}) {
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      throw new Error('Missing OpenRouter API key. Add it in Model Settings.');
    }

    const modelConfig = getModelConfig();
    const response = await fetch(
      `${API_BASE}/api/council/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenRouter-Api-Key': apiKey,
        },
        body: JSON.stringify({
          content,
          model_config: modelConfig,
          is_first_message: !!options.isFirstMessage,
          conversation_context: options.conversationContext || [],
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || 'Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Robust SSE parsing: network chunks may split a single SSE event across reads.
    // Buffer until we have complete SSE messages separated by a blank line.
    let buffer = '';
    let sawComplete = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush any remaining bytes.
        buffer += decoder.decode();
        break;
      }

      // Normalize CRLF just in case.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      // Process complete SSE messages. SSE messages are delimited by a blank line.
      // Each message can contain multiple `data:` lines; join them with \n (SSE spec).
      let boundaryIndex;
      // eslint-disable-next-line no-cond-assign
      while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawMessage = buffer.slice(0, boundaryIndex);
        buffer = buffer.slice(boundaryIndex + 2);

        const dataLines = rawMessage
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.replace(/^data:\s?/, ''));

        if (dataLines.length === 0) continue;

        const data = dataLines.join('\n');
        try {
          const event = JSON.parse(data);
          if (event?.type === 'complete') sawComplete = true;
          onEvent(event.type, event);
        } catch (e) {
          // If parsing fails, keep going. This should be rare now that we buffer properly.
          console.error('Failed to parse SSE event:', e);
        }
      }
    }

    // If the stream ended without a `complete` event (e.g. proxy truncation),
    // emit a synthetic completion so the UI can finalize.
    if (!sawComplete) {
      onEvent('complete', { type: 'complete', synthetic: true });
    }
  },

  /**
   * Get available models from OpenRouter.
   */
  async getAvailableModels() {
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      throw new Error('Missing OpenRouter API key. Add it in Model Settings.');
    }

    const response = await fetch(`${API_BASE}/api/models`, {
      headers: {
        'X-OpenRouter-Api-Key': apiKey,
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || 'Failed to fetch available models');
    }
    return response.json();
  },
};
