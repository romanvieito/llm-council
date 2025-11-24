import { db } from '../database/db.js';

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
      const conversations = await db.listConversations();
      res.status(200).json(conversations);
      return;
    }

    if (req.method === 'POST') {
      const conversationId = crypto.randomUUID();
      const conversation = await db.createConversation(conversationId);

      res.status(200).json({
        id: conversation.id,
        created_at: conversation.created_at.toISOString(),
        title: conversation.title,
        messages: []
      });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database operation failed:', error);
    res.status(500).json({ error: 'Database operation failed' });
  }
}
