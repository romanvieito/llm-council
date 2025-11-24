import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'conversations');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      ensureDataDir();

      // Read all conversation files
      const conversations = [];
      const files = fs.readdirSync(DATA_DIR);

      for (const filename of files) {
        if (filename.endsWith('.json')) {
          try {
            const filePath = path.join(DATA_DIR, filename);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Return metadata only
            conversations.push({
              id: data.id,
              created_at: data.created_at,
              title: data.title || 'New Conversation',
              message_count: data.messages ? data.messages.length : 0
            });
          } catch (fileError) {
            console.error(`Error reading conversation file ${filename}:`, fileError);
            // Continue with other files
          }
        }
      }

      // Sort by creation time, newest first
      conversations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.status(200).json(conversations);
    } catch (error) {
      console.error('Error listing conversations:', error);
      res.status(500).json({ error: 'Failed to list conversations' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      ensureDataDir();

      const conversationId = crypto.randomUUID();
      const conversation = {
        id: conversationId,
        created_at: new Date().toISOString(),
        title: 'New Conversation',
        messages: []
      };

      // Save to file
      const filePath = path.join(DATA_DIR, `${conversationId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));

      res.status(200).json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
