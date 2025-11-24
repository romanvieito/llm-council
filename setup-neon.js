import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function setupNeon() {
  try {
    console.log('🚀 Setting up Neon PostgreSQL database...');

    // Check if neonctl is authenticated
    try {
      execSync('npx neonctl me', { stdio: 'pipe' });
      console.log('✅ Neon CLI is authenticated');
    } catch (error) {
      console.log('❌ Neon CLI not authenticated. Please run: npx neonctl auth');
      console.log('Then re-run this script.');
      return;
    }

    // Create a new Neon project
    console.log('📦 Creating Neon project...');
    const projectOutput = execSync('npx neonctl projects create --name llm-council-db --region aws-us-east-1', {
      encoding: 'utf8'
    });
    console.log('Project created:', projectOutput);

    // Extract connection string from output (Neon creates default database)
    const connectionStringMatch = projectOutput.match(/postgresql:\/\/[^\s]+/);
    if (!connectionStringMatch) {
      throw new Error('Could not extract connection string from output');
    }
    const connectionString = connectionStringMatch[0];
    console.log('✅ Database connection string obtained');

    console.log('✅ Database setup complete!');
    console.log('📋 Connection string:', connectionString);

    // Create .env.local file for local development
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = `DATABASE_URL="${connectionString}"\n`;

    fs.writeFileSync(envPath, envContent);
    console.log('📝 Created .env.local file for local development');

    // Initialize database schema
    console.log('🏗️ Initializing database schema...');
    execSync('npm run db:init', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: connectionString } });

    console.log('🎉 Setup complete! Database is ready.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Add DATABASE_URL environment variable to Vercel:');
    console.log(`   Value: ${connectionString}`);
    console.log('2. Redeploy to Vercel: vercel --prod');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupNeon();
