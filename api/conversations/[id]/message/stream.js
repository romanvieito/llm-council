export default function handler(req, res) {
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

  if (req.method === 'POST') {
    // Extract conversation ID from URL path
    // req.url is the pathname (e.g., '/api/conversations/123/message/stream')
    const urlPath = req.url.split('?')[0]; // Remove query string if present
    const pathParts = urlPath.split('/');
    const conversationId = pathParts[pathParts.length - 3]; // -3 because last parts are 'message/stream'
    const { content } = req.body;

    // Send mock streaming events
    // In production, this would stream from the actual LLM council backend
    const sendEvent = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    // Simulate the 3-stage process
    sendEvent('stage1_start');
    setTimeout(() => {
      sendEvent('stage1_complete', {
        data: {
          responses: [
            { model: 'model1', response: 'Mock response 1' },
            { model: 'model2', response: 'Mock response 2' }
          ]
        }
      });

      sendEvent('stage2_start');
      setTimeout(() => {
        sendEvent('stage2_complete', {
          data: { rankings: [] },
          metadata: { label_to_model: {}, aggregate_rankings: {} }
        });

        sendEvent('stage3_start');
        setTimeout(() => {
          sendEvent('stage3_complete', {
            data: {
              final_answer: 'This is a mock streaming response. The actual LLM council backend needs to be connected.'
            }
          });

          sendEvent('complete');
          res.end();
        }, 500);
      }, 500);
    }, 500);

    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
