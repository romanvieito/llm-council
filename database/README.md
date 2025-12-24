# Database Setup - Neon PostgreSQL

This project uses [Neon](https://neon.tech) for serverless PostgreSQL database.

## Setup Instructions

### 1. Create Neon Account
1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project

### 2. Get Database URL
1. In your Neon dashboard, go to **Connection Details**
2. Copy the **Connection String** (it should look like: `postgresql://user:password@host/database?sslmode=require`)

### 3. Set Environment Variables
Add the database URL to your environment:

**For local development:**
```bash
export DATABASE_URL="your_neon_connection_string_here"
```

**For Vercel production:**
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add: `DATABASE_URL` = `your_neon_connection_string_here`

### 4. Initialize Database Schema
Run the database initialization script:

```bash
npm run db:init
```

This will create the necessary tables:
- `conversations` - stores conversation metadata
- `messages` - stores all messages with LLM responses

### 5. Verify Setup
Test that everything works by running the app locally and creating a conversation.

## Database Schema

### conversations table
- `id` (UUID) - Primary key
- `created_at` (TIMESTAMP) - When conversation was created
- `title` (TEXT) - Conversation title

### messages table
- `id` (SERIAL) - Primary key
- `conversation_id` (UUID) - Foreign key to conversations
- `role` (TEXT) - 'user' or 'assistant'
- `content` (TEXT) - User message content
- `stage1` (JSONB) - Individual LLM responses
- `stage2` (JSONB) - Peer rankings
- `stage3` (JSONB) - Final synthesis
- `created_at` (TIMESTAMP) - When message was created

## Troubleshooting

If you get connection errors:
1. Make sure your Neon database is not paused
2. Verify the DATABASE_URL is correct
3. Check that your IP is allowlisted in Neon (or use SSL mode)



