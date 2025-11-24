import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// Initialize database with schema
async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  try {
    console.log('Initializing database...');

    // Read schema file
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    await sql.unsafe(schema);

    console.log('✅ Database initialized successfully!');
    console.log('Tables created: conversations, messages');
    console.log('Indexes created for better performance');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
