import { getDatabase } from './init';
import {
  BRIEF_PROMPT,
  ARC_PROMPT,
  SOURCING_PROMPT,
  ARTICLE_PROMPT,
  VIDEO_PROMPT,
  QUIZ_PROMPT,
  EXERCISE_PROMPT,
  QC_PROMPT,
  FIX_PROMPT,
  PACK_PROMPT
} from '../prompts';

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export async function seedPromptTemplates(): Promise<void> {
  const db = await getDatabase();

  const templates = [
    {
      id: generateId(),
      name: 'Brief Normalizer',
      category: 'brief',
      template: BRIEF_PROMPT
    },
    {
      id: generateId(),
      name: 'ARC & Matrix Agent',
      category: 'matrix',
      template: ARC_PROMPT
    },
    {
      id: generateId(),
      name: 'Sourcing Agent',
      category: 'sourcing',
      template: SOURCING_PROMPT
    },
    {
      id: generateId(),
      name: 'Article Writer',
      category: 'article',
      template: ARTICLE_PROMPT
    },
    {
      id: generateId(),
      name: 'Video Script Writer',
      category: 'video',
      template: VIDEO_PROMPT
    },
    {
      id: generateId(),
      name: 'Quiz Builder',
      category: 'quiz',
      template: QUIZ_PROMPT
    },
    {
      id: generateId(),
      name: 'Exercise Designer',
      category: 'exercise',
      template: EXERCISE_PROMPT
    },
    {
      id: generateId(),
      name: 'QC Agent',
      category: 'qc',
      template: QC_PROMPT
    },
    {
      id: generateId(),
      name: 'Fixer',
      category: 'fix',
      template: FIX_PROMPT
    },
    {
      id: generateId(),
      name: 'Packager',
      category: 'pack',
      template: PACK_PROMPT
    }
  ];

  // Check if templates already exist
  const existingCount = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM prompt_templates'
  );

  if (existingCount && existingCount.count > 0) {
    console.log('Prompt templates already seeded, skipping...');
    return;
  }

  // Insert all templates
  for (const template of templates) {
    await db.run(
      'INSERT INTO prompt_templates (id, name, category, template) VALUES (?, ?, ?, ?)',
      [template.id, template.name, template.category, template.template]
    );
  }

  console.log(`Seeded ${templates.length} prompt templates`);
}
