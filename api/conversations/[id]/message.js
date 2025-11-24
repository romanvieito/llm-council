import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      // Extract conversation ID from URL path
      // req.url is the pathname (e.g., '/api/conversations/123/message')
      const urlPath = req.url.split('?')[0]; // Remove query string if present
      const pathParts = urlPath.split('/');
      const conversationId = pathParts[pathParts.length - 2]; // -2 because last part is 'message'
      const { content } = req.body;

      // Get existing conversation
      const conversation = await kv.get(`conversation:${conversationId}`);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: content
      });

      // Generate mock assistant response
      const mockAssistantMessage = {
        role: 'assistant',
        stage1: {
          responses: [
            { model: 'openai/gpt-5.1', response: 'Mock response from GPT-5.1' },
            { model: 'google/gemini-3-pro-preview', response: 'Mock response from Gemini' },
            { model: 'anthropic/claude-sonnet-4.5', response: 'Mock response from Claude' },
            { model: 'x-ai/grok-4', response: 'Mock response from Grok' }
          ]
        },
        stage2: {
          rankings: [
            {
              model: 'openai/gpt-5.1',
              ranking: 'Response A: Best comprehensive analysis. Response B: Good examples. Response C: Concise. Response D: Creative.',
              parsed_ranking: ['Response A', 'Response B', 'Response C', 'Response D']
            }
          ]
        },
        stage3: {
          model: 'google/gemini-3-pro-preview',
          response: 'This is a mock final synthesis from the LLM Council Chairman. In production, this would be a carefully crafted response that combines the best insights from all council members.'
        },
        metadata: {
          models_used: ['openai/gpt-5.1', 'google/gemini-3-pro-preview', 'anthropic/claude-sonnet-4.5', 'x-ai/grok-4'],
          total_tokens: 0
        }
      };

      conversation.messages.push(mockAssistantMessage);

      // Save updated conversation
      await kv.set(`conversation:${conversationId}`, conversation);

      res.status(200).json({
        stage1: mockAssistantMessage.stage1,
        stage2: mockAssistantMessage.stage2,
        stage3: mockAssistantMessage.stage3,
        metadata: mockAssistantMessage.metadata
      });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('KV operation failed:', error);
    res.status(500).json({ error: 'Database operation failed' });
  }
}
