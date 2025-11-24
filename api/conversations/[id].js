import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // Extract conversation ID from URL path
      // req.url is the pathname (e.g., '/api/conversations/123' or '/api/conversations/123?id=...')
      const urlPath = req.url.split('?')[0]; // Remove query string if present
      const pathParts = urlPath.split('/');
      const conversationId = pathParts[pathParts.length - 1];

      const conversation = await kv.get(`conversation:${conversationId}`);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.status(200).json(conversation);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('KV operation failed:', error);
    res.status(500).json({ error: 'Database operation failed' });
  }
}
