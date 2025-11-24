// Simple in-memory store (note: this won't persist across serverless invocations)
// In production, use a database
const conversations = {};

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
    // Return list of conversations as metadata
    const list = Object.values(conversations).map(conv => ({
      id: conv.id,
      created_at: conv.created_at,
      title: conv.title,
      message_count: conv.messages ? conv.messages.length : 0
    }));
    res.status(200).json(list);
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
    
    // Store in memory (note: won't persist in serverless)
    conversations[conversationId] = conversation;
    
    res.status(200).json(conversation);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
