import { getDatabase } from './init';

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export async function seedPromptTemplates(): Promise<void> {
  const db = await getDatabase();

  const templates = [
    {
      id: 'approach-gen-content-001',
      name: 'Approach Generation (from Content)',
      category: 'approach_generation_content',
      template: `You are an instructional designer analyzing content to recommend learning approaches.

CLIENT BRIEF:
- Client: {{clientName}}
- Industry: {{industry}}
- Objectives: {{objectives}}
- Audience: {{audience}}

CONTENT ANALYSIS:
{{contentPreview}}

TASK:
Analyze the content and recommend 3 different learning approaches that would work well with this material.

Return JSON with:
- approaches: Array of 3 approach objects with:
  - id: Unique identifier (e.g., "scenario-based", "progressive-mastery", "problem-solving")
  - name: Approach name (3-5 words)
  - description: Clear description of the approach (2 sentences)
  - methodology: How it works (1 sentence)
  - bestFor: Array of 2-3 learner characteristics this approach suits (e.g., "Visual learners", "Experienced professionals")

Make approaches diverse and specifically suited to the content type and audience.`
    },
    {
      id: 'arc-gen-001',
      name: 'Learning Arc Generation',
      category: 'arc_generation',
      template: `You are an instructional designer creating a narrative learning arc.

CLIENT BRIEF:
- Client: {{clientName}}
- Industry: {{industry}}
- Objectives: {{objectives}}
- Audience: {{audience}}

SELECTED APPROACH: {{selectedApproach}}

CONTENT OVERVIEW:
{{contentPreview}}
{{feedbackContext}}

TASK:
Create a cohesive learning arc that structures the training material into a compelling narrative journey.

Return JSON with:
- title: A compelling title for the overall learning journey (5-8 words)
- narrative: A 2-3 sentence description of the overarching story/theme that connects all sessions
- progression: Array of 4-6 learning phases with:
  - phase: Phase name (e.g., "Foundation", "Application", "Mastery")
  - focus: What learners achieve in this phase (1 sentence)

The arc should create a sense of progression and purpose, not just a list of topics.`
    },
    {
      id: 'matrix-gen-content-001',
      name: 'Program Matrix Generation (from Content)',
      category: 'matrix_generation_content',
      template: `You are an instructional designer creating a training program structure.

CLIENT BRIEF:
- Client: {{clientName}}
- Industry: {{industry}}
- Objectives: {{objectives}}
- Audience: {{audience}}

EXTRACTED CONTENT:
{{contentPreview}}
{{arcContext}}

TASK:
Analyze the extracted content and create a structured training program{{arcContextNote}}. Return JSON with:
- programTitle: Concise program title
- overview: 2-3 sentence program description
- totalSessions: Number of sessions (typically 3-8)
- targetAudience: Who this is for
- sessions: Array of session objects with:
  - sessionNumber: Session number
  - title: Session title
  - objectives: Array of 2-4 learning objectives for this session
  - topics: Array of 3-6 topics covered
  - estimatedDuration: Duration (e.g., "45 minutes", "1 hour")
  - keyTakeaways: Array of 2-3 main takeaways

Structure the content logically, building from fundamentals to advanced concepts.`
    },
    {
      id: 'sample-gen-001',
      name: 'Sample Content Generation',
      category: 'sample_generation',
      template: `You are a training content creator generating a complete learning session.

CLIENT BRIEF:
- Client: {{clientName}}
- Industry: {{industry}}
- Audience: {{audience}}

LEARNING ARC:
- Title: {{arcTitle}}
- Narrative: {{arcNarrative}}
- Current Phase: {{currentPhase}}

SESSION TO CREATE:
- Title: {{sessionTitle}}
- Objectives: {{sessionObjectives}}
- Topics: {{sessionTopics}}
- Duration: {{sessionDuration}}
- Key Takeaways: {{sessionTakeaways}}
{{feedbackContext}}

TASK:
Create a complete training session with both article and quiz.

Return JSON with:
- article:
  - title: Engaging article title
  - content: Full article content (800-1200 words) formatted with paragraphs, bullet points, examples
  - readingTime: Estimated reading time (e.g., "8 minutes")

- quiz:
  - questions: Array of 4-5 multiple choice questions with:
    - question: The question text
    - options: Array of 4 answer choices
    - correctIndex: Index of correct answer (0-3)
    - explanation: Why this is correct (1-2 sentences)

Make the content engaging, practical, and aligned with the learning objectives.`
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
