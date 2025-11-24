import { db } from '../../../../database/db.js';

export default async function handler(req, res) {
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

  try {
    if (req.method === 'POST') {
      // Extract conversation ID from URL path
      // req.url is the pathname (e.g., '/api/conversations/123/message/stream')
      const urlPath = req.url.split('?')[0]; // Remove query string if present
      const pathParts = urlPath.split('/');
      const conversationId = pathParts[pathParts.length - 3]; // -3 because last parts are 'message/stream'
      const { content } = req.body;

      // Check if conversation exists
      const conversation = await db.getConversation(conversationId);
      if (!conversation) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Conversation not found' })}\n\n`);
        res.end();
        return;
      }

      // Check if this is the first message to generate a title
      const isFirstMessage = conversation.messages.length === 0;

      // Add user message
      await db.addUserMessage(conversationId, content);

      // Send mock streaming events
      const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      // Simulate the 3-stage process
      sendEvent('stage1_start');
      setTimeout(() => {
        const stage1Data = {
          responses: [
            { model: 'openai/gpt-5.1', response: 'Mock response 1' },
            { model: 'google/gemini-3-pro-preview', response: 'Mock response 2' },
            { model: 'anthropic/claude-sonnet-4.5', response: 'Mock response 3' },
            { model: 'x-ai/grok-4', response: 'Mock response 4' }
          ]
        };

        sendEvent('stage1_complete', { data: stage1Data });

        sendEvent('stage2_start');
        setTimeout(() => {
          const stage2Data = {
            rankings: [
              {
                model: 'openai/gpt-5.1',
                ranking: 'Response A: Best. Response B: Good. Response C: OK. Response D: Creative.',
                parsed_ranking: ['Response A', 'Response B', 'Response C', 'Response D']
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
            aggregate_rankings: { 'Response A': 1, 'Response B': 2, 'Response C': 3, 'Response D': 4 }
          };

          sendEvent('stage2_complete', { data: stage2Data, metadata });

          sendEvent('stage3_start');
          setTimeout(async () => {
            const stage3Data = {
              model: 'google/gemini-3-pro-preview',
              response: 'This is a mock streaming response from the LLM Council Chairman.'
            };

            sendEvent('stage3_complete', { data: stage3Data });

            // Update title if this was the first message
            if (isFirstMessage) {
              const newTitle = `Discussion: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`;
              await db.updateConversationTitle(conversationId, newTitle);
              sendEvent('title_complete', { data: { title: newTitle } });
            }

            // Add assistant message
            await db.addAssistantMessage(conversationId, stage1Data, stage2Data, stage3Data);

            sendEvent('complete');
            res.end();
          }, 500);
        }, 500);
      }, 500);

      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database operation failed:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Database operation failed' })}\n\n`);
    res.end();
  }
}
