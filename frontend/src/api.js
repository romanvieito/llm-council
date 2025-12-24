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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
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
