export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-OpenRouter-Api-Key');
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get API key from header
    const apiKey = req.headers['x-openrouter-api-key'];
    if (!apiKey) {
      res.status(401).json({ error: 'Missing X-OpenRouter-Api-Key header' });
      return;
    }

    // Fetch models from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ 
        error: `OpenRouter API error: ${errorText}` 
      });
      return;
    }

    const data = await response.json();

    // Transform the response to match expected format
    const models = data.data.map(model => {
      const modelId = model.id || '';
      let provider = model.owned_by || '';
      if (!provider && modelId.includes('/')) {
        provider = modelId.split('/')[0];
      }

      return {
        id: modelId,
        name: model.name || modelId,
        description: model.description || '',
        pricing: model.pricing || {},
        context_length: model.context_length || null,
        supported_parameters: model.supported_parameters || [],
        provider: provider,
        created: model.created || null,
      };
    });

    res.status(200).json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available models',
      details: error.message 
    });
  }
}

