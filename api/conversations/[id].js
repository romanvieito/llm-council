import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'conversations');

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Extract conversation ID from URL path
    // req.url is the pathname (e.g., '/api/conversations/123' or '/api/conversations/123?id=...')
    const urlPath = req.url.split('?')[0]; // Remove query string if present
    const pathParts = urlPath.split('/');
    const conversationId = pathParts[pathParts.length - 1];

    try {
      const filePath = path.join(DATA_DIR, `${conversationId}.json`);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.status(200).json(conversation);
    } catch (error) {
      console.error('Error reading conversation:', error);
      res.status(500).json({ error: 'Failed to get conversation' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
