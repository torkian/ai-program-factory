import { getDatabase } from './init';

export interface WorkflowSession {
  id: string;
  status: 'active' | 'completed' | 'paused';
  current_step: string;
  route: 'A' | 'B' | null;
  client_name: string;
  industry: string;
  created_at: string;
  updated_at: string;
}

export interface SessionData {
  session_id: string;
  data_key: string;
  data_value: string;
  created_at: string;
}

export interface HumanDecision {
  id: string;
  session_id: string;
  step: string;
  decision: string;
  feedback: string | null;
  decided_at: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedContent {
  id: string;
  session_id: string;
  content_type: 'article' | 'quiz' | 'script';
  title: string;
  content: string;
  metadata: string | null;
  created_at: string;
}

// Workflow Session Queries
export async function createSession(
  id: string,
  clientName: string,
  industry: string
): Promise<WorkflowSession> {
  const db = await getDatabase();

  await db.run(
    'INSERT INTO workflow_sessions (id, client_name, industry) VALUES (?, ?, ?)',
    [id, clientName, industry]
  );

  return await getSession(id);
}

export async function getSession(id: string): Promise<WorkflowSession> {
  const db = await getDatabase();
  const session = await db.get<WorkflowSession>(
    'SELECT * FROM workflow_sessions WHERE id = ?',
    [id]
  );

  if (!session) {
    throw new Error(`Session not found: ${id}`);
  }

  return session;
}

export async function updateSession(
  id: string,
  updates: Partial<WorkflowSession>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.current_step) {
    fields.push('current_step = ?');
    values.push(updates.current_step);
  }
  if (updates.route) {
    fields.push('route = ?');
    values.push(updates.route);
  }
  if (updates.client_name) {
    fields.push('client_name = ?');
    values.push(updates.client_name);
  }
  if (updates.industry) {
    fields.push('industry = ?');
    values.push(updates.industry);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await db.run(
    `UPDATE workflow_sessions SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function getAllSessions(): Promise<WorkflowSession[]> {
  const db = await getDatabase();
  return await db.all<WorkflowSession[]>(
    'SELECT * FROM workflow_sessions ORDER BY created_at DESC'
  );
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDatabase();

  // Delete all related data (cascading delete)
  await db.run('DELETE FROM generated_content WHERE session_id = ?', [id]);
  await db.run('DELETE FROM human_decisions WHERE session_id = ?', [id]);
  await db.run('DELETE FROM session_data WHERE session_id = ?', [id]);
  await db.run('DELETE FROM workflow_sessions WHERE id = ?', [id]);
}

// Session Data Queries
export async function saveSessionData(
  sessionId: string,
  dataKey: string,
  dataValue: any
): Promise<void> {
  const db = await getDatabase();
  const jsonValue = typeof dataValue === 'string' ? dataValue : JSON.stringify(dataValue);

  await db.run(
    'INSERT OR REPLACE INTO session_data (session_id, data_key, data_value) VALUES (?, ?, ?)',
    [sessionId, dataKey, jsonValue]
  );
}

export async function getSessionData<T = any>(
  sessionId: string,
  dataKey: string
): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.get<SessionData>(
    'SELECT data_value FROM session_data WHERE session_id = ? AND data_key = ?',
    [sessionId, dataKey]
  );

  if (!row) {
    return null;
  }

  try {
    return JSON.parse(row.data_value);
  } catch {
    return row.data_value as any;
  }
}

export async function getAllSessionData(sessionId: string): Promise<Record<string, any>> {
  const db = await getDatabase();
  const rows = await db.all<SessionData[]>(
    'SELECT data_key, data_value FROM session_data WHERE session_id = ?',
    [sessionId]
  );

  const result: Record<string, any> = {};
  for (const row of rows) {
    try {
      result[row.data_key] = JSON.parse(row.data_value);
    } catch {
      result[row.data_key] = row.data_value;
    }
  }

  return result;
}

// Human Decision Queries
export async function saveDecision(
  id: string,
  sessionId: string,
  step: string,
  decision: string,
  feedback?: string
): Promise<void> {
  const db = await getDatabase();

  await db.run(
    'INSERT INTO human_decisions (id, session_id, step, decision, feedback) VALUES (?, ?, ?, ?, ?)',
    [id, sessionId, step, decision, feedback || null]
  );
}

export async function getDecisions(sessionId: string): Promise<HumanDecision[]> {
  const db = await getDatabase();
  return await db.all<HumanDecision[]>(
    'SELECT * FROM human_decisions WHERE session_id = ? ORDER BY decided_at ASC',
    [sessionId]
  );
}

// Prompt Template Queries
export async function createPromptTemplate(
  id: string,
  name: string,
  category: string,
  template: string
): Promise<void> {
  const db = await getDatabase();

  await db.run(
    'INSERT INTO prompt_templates (id, name, category, template) VALUES (?, ?, ?, ?)',
    [id, name, category, template]
  );
}

export async function getPromptTemplate(id: string): Promise<PromptTemplate | null> {
  const db = await getDatabase();
  const result = await db.get<PromptTemplate>(
    'SELECT * FROM prompt_templates WHERE id = ?',
    [id]
  );
  return result || null;
}

export async function getPromptTemplateByCategory(
  category: string
): Promise<PromptTemplate | null> {
  const db = await getDatabase();
  const result = await db.get<PromptTemplate>(
    'SELECT * FROM prompt_templates WHERE category = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
    [category]
  );
  return result || null;
}

export async function getAllPromptTemplates(): Promise<PromptTemplate[]> {
  const db = await getDatabase();
  return await db.all<PromptTemplate[]>(
    'SELECT * FROM prompt_templates ORDER BY category, created_at DESC'
  );
}

export async function updatePromptTemplate(
  id: string,
  template: string
): Promise<void> {
  const db = await getDatabase();

  await db.run(
    'UPDATE prompt_templates SET template = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [template, id]
  );
}

// Generated Content Queries
export async function saveContent(
  id: string,
  sessionId: string,
  contentType: 'article' | 'quiz' | 'script',
  title: string,
  content: string,
  metadata?: any
): Promise<void> {
  const db = await getDatabase();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  await db.run(
    'INSERT INTO generated_content (id, session_id, content_type, title, content, metadata) VALUES (?, ?, ?, ?, ?, ?)',
    [id, sessionId, contentType, title, content, metadataJson]
  );
}

export async function getContent(id: string): Promise<GeneratedContent | null> {
  const db = await getDatabase();
  const result = await db.get<GeneratedContent>(
    'SELECT * FROM generated_content WHERE id = ?',
    [id]
  );
  return result || null;
}

export async function getSessionContent(
  sessionId: string,
  contentType?: 'article' | 'quiz' | 'script'
): Promise<GeneratedContent[]> {
  const db = await getDatabase();

  if (contentType) {
    return await db.all<GeneratedContent[]>(
      'SELECT * FROM generated_content WHERE session_id = ? AND content_type = ? ORDER BY created_at ASC',
      [sessionId, contentType]
    );
  }

  return await db.all<GeneratedContent[]>(
    'SELECT * FROM generated_content WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId]
  );
}
