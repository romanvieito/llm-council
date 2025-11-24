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
    // Extract conversation ID from URL
    // For Vercel dynamic routes, the parameter is in the URL path
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/');
    const conversationId = pathParts[pathParts.length - 1];
    
    // Return a default conversation structure
    // In production, this would fetch from a database
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
