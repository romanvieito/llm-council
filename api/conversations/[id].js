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
    const conversationId = req.query.id;
    
    // Return a default conversation structure
    // In production, this would fetch from a database
    // For now, return a valid structure even if conversation doesn't exist
    const conversation = {
      id: conversationId,
      created_at: new Date().toISOString(),
      title: 'New Conversation',
      messages: []
    };

    res.status(200).json(conversation);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
