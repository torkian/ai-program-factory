import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  const dbPath = path.join(__dirname, '../../factory.db');

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create tables
  await db.exec(`
    -- Workflow sessions
    CREATE TABLE IF NOT EXISTS workflow_sessions (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'active',
      current_step TEXT DEFAULT 'brief',
      route TEXT,
      client_name TEXT,
      industry TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Session data (JSON storage for flexibility)
    CREATE TABLE IF NOT EXISTS session_data (
      session_id TEXT,
      data_key TEXT,
      data_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, data_key),
      FOREIGN KEY (session_id) REFERENCES workflow_sessions(id) ON DELETE CASCADE
    );

    -- Human decisions
    CREATE TABLE IF NOT EXISTS human_decisions (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      step TEXT,
      decision TEXT,
      feedback TEXT,
      decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES workflow_sessions(id) ON DELETE CASCADE
    );

    -- Prompt templates
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      template TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Generated content
    CREATE TABLE IF NOT EXISTS generated_content (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      content_type TEXT,
      title TEXT,
      content TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES workflow_sessions(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_session_data_session_id ON session_data(session_id);
    CREATE INDEX IF NOT EXISTS idx_human_decisions_session_id ON human_decisions(session_id);
    CREATE INDEX IF NOT EXISTS idx_generated_content_session_id ON generated_content(session_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
    CREATE INDEX IF NOT EXISTS idx_workflow_sessions_status ON workflow_sessions(status);
  `);

  console.log('Database initialized successfully');
  return db;
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return await initDatabase();
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
