export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    // Extract conversation ID from URL path
    // req.url is the pathname (e.g., '/api/conversations/123/message')
    const pathParts = req.url.split('/');
    const conversationId = pathParts[pathParts.length - 2]; // -2 because last part is 'message'
    const { content } = req.body;

    // For now, return a mock response
    // In production, this would call the actual LLM council backend
    res.status(200).json({
      stage1: {
        responses: [
          { model: 'model1', response: 'Mock response 1' },
          { model: 'model2', response: 'Mock response 2' }
        ]
      },
      stage2: {
        rankings: []
      },
      stage3: {
        final_answer: 'This is a mock response. The actual LLM council backend needs to be connected.'
      },
      metadata: {
        models_used: [],
        total_tokens: 0
      }
    });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
