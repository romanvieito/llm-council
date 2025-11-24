import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'conversations');

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
    const urlPath = req.url.split('?')[0]; // Remove query string if present
    const pathParts = urlPath.split('/');
    const conversationId = pathParts[pathParts.length - 2]; // -2 because last part is 'message'
    const { content } = req.body;

    try {
      const filePath = path.join(DATA_DIR, `${conversationId}.json`);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Load existing conversation
      const conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Add user message
      conversation.messages.push({
        role: 'user',
        content: content
      });

      // Generate mock assistant response (in production, this would be the actual LLM council processing)
      const mockAssistantMessage = {
        role: 'assistant',
        stage1: [
          {
            model: 'openai/gpt-5.1',
            response: 'This is a mock response from the LLM Council. In production, this would contain the actual individual model responses.'
          },
          {
            model: 'google/gemini-3-pro-preview',
            response: 'Mock response from Gemini model. The real implementation would process your query through multiple LLMs.'
          },
          {
            model: 'anthropic/claude-sonnet-4.5',
            response: 'Mock response from Claude. Each model would provide its unique perspective on your question.'
          },
          {
            model: 'x-ai/grok-4',
            response: 'Mock response from Grok. The council would then rank and synthesize these responses.'
          }
        ],
        stage2: [
          {
            model: 'openai/gpt-5.1',
            ranking: 'Response A (OpenAI): Comprehensive and well-structured analysis. Response B (Google): Good coverage of key points. Response C (Anthropic): Concise but lacks depth. Response D (xAI): Solid but less detailed.',
            parsed_ranking: ['Response A', 'Response B', 'Response D', 'Response C']
          },
          {
            model: 'google/gemini-3-pro-preview',
            ranking: 'Response B: Best overall balance of depth and accessibility. Response A: Very thorough but lengthy. Response D: Good examples and structure. Response C: Too brief for complex topic.',
            parsed_ranking: ['Response B', 'Response A', 'Response D', 'Response C']
          }
        ],
        stage3: {
          model: 'google/gemini-3-pro-preview',
          response: 'This is a mock final synthesis from the LLM Council Chairman. In production, this would be a carefully crafted response that combines the best insights from all council members, considering their peer rankings and individual expertise. The Chairman would resolve any conflicts, eliminate redundancies, and present a coherent, comprehensive answer to your query.'
        }
      };

      conversation.messages.push(mockAssistantMessage);

      // Save updated conversation
      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));

      // Return the mock response (in production this would be the real processing result)
      res.status(200).json({
        stage1: mockAssistantMessage.stage1,
        stage2: mockAssistantMessage.stage2,
        stage3: mockAssistantMessage.stage3,
        metadata: {
          models_used: ['openai/gpt-5.1', 'google/gemini-3-pro-preview', 'anthropic/claude-sonnet-4.5', 'x-ai/grok-4'],
          total_tokens: 0
        }
      });
    } catch (error) {
      console.error('Error processing message:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
