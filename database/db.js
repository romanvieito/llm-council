import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Database operations
export const db = {
  // Conversations
  async createConversation(id, title = 'New Conversation') {
    const result = await sql`
      INSERT INTO conversations (id, title)
      VALUES (${id}, ${title})
      RETURNING *
    `;
    return result[0];
  },

  async getConversation(id) {
    const result = await sql`
      SELECT * FROM conversations WHERE id = ${id}
    `;
    if (result.length === 0) return null;

    const conversation = result[0];

    // Get messages for this conversation
    const messages = await sql`
      SELECT * FROM messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    `;

    return {
      ...conversation,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        stage1: msg.stage1,
        stage2: msg.stage2,
        stage3: msg.stage3
      }))
    };
  },

  async listConversations() {
    const result = await sql`
      SELECT
        c.id,
        c.created_at,
        c.title,
        COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      GROUP BY c.id, c.created_at, c.title
      ORDER BY c.created_at DESC
    `;

    return result.map(conv => ({
      id: conv.id,
      created_at: conv.created_at.toISOString(),
      title: conv.title,
      message_count: parseInt(conv.message_count)
    }));
  },

  async updateConversationTitle(id, title) {
    await sql`
      UPDATE conversations
      SET title = ${title}
      WHERE id = ${id}
    `;
  },

  // Messages
  async addUserMessage(conversationId, content) {
    await sql`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${conversationId}, 'user', ${content})
    `;
  },

  async addAssistantMessage(conversationId, stage1, stage2, stage3) {
    await sql`
      INSERT INTO messages (conversation_id, role, stage1, stage2, stage3)
      VALUES (${conversationId}, 'assistant', ${JSON.stringify(stage1)}, ${JSON.stringify(stage2)}, ${JSON.stringify(stage3)})
    `;
  }
};
