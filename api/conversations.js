import { kv } from '@vercel/kv';

const CONVERSATIONS_LIST_KEY = 'conversations:list';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // Get list of conversation IDs
      const conversationIds = await kv.smembers(CONVERSATIONS_LIST_KEY) || [];

      // Get all conversations
      const conversations = [];
      for (const id of conversationIds) {
        const conversation = await kv.get(`conversation:${id}`);
        if (conversation) {
          conversations.push({
            id: conversation.id,
            created_at: conversation.created_at,
            title: conversation.title || 'New Conversation',
            message_count: conversation.messages ? conversation.messages.length : 0
          });
        }
      }

      // Sort by creation time, newest first
      conversations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.status(200).json(conversations);
      return;
    }

    if (req.method === 'POST') {
      const conversationId = crypto.randomUUID();
      const conversation = {
        id: conversationId,
        created_at: new Date().toISOString(),
        title: 'New Conversation',
        messages: []
      };

      // Store conversation in KV
      await kv.set(`conversation:${conversationId}`, conversation);

      // Add to conversations list
      await kv.sadd(CONVERSATIONS_LIST_KEY, conversationId);

      res.status(200).json(conversation);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('KV operation failed:', error);
    res.status(500).json({ error: 'Database operation failed' });
  }
}
