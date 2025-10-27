import { getDatabase } from './init';

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export function getDefaultTemplates() {
  return [
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
- Business Context: {{businessContext}}
- Business Challenges: {{businessChallenges}}
- Learning Gap: {{learningGap}}

EXTRACTED CONTENT:
{{contentPreview}}
{{arcContext}}

TASK:
Analyze the content and create a structured training program{{arcContextNote}} organized into CHAPTERS containing SESSIONS.

CHAPTER DEFINITION:
- A chapter represents a major thematic area or competency domain
- Contains 3-5 related sessions that build toward chapter goals
- Has clear learning progression within it

Return JSON with:
- programTitle: Concise program title
- overview: 2-3 sentence program description
- totalChapters: Number of chapters (typically 3-4, can be more for extensive programs)
- totalSessions: Total number of sessions across all chapters
- targetAudience: Who this is for
- chapters: Array of chapter objects with:
  - chapterNumber: Chapter number (1, 2, 3...)
  - title: Chapter title representing the theme/domain
  - description: What this chapter covers (2 sentences)
  - goals: Array of 2-3 main goals for this chapter
  - sessions: Array of session objects with:
    - sessionNumber: Overall session number (1, 2, 3... across entire program)
    - chapterNumber: Which chapter this belongs to
    - title: Session title
    - objectives: Array of 2-4 learning objectives for this session
    - topics: Array of 3-6 topics covered
    - estimatedDuration: Duration (e.g., "45 minutes", "1 hour")
    - keyTakeaways: Array of 2-3 main takeaways
    - contentOutline: Detailed 3-5 sentence outline of what content this session should cover
    - prerequisites: What learners should know before this session (optional)

Structure logically: Chapters progress from fundamentals to advanced; sessions within chapters build progressively.`
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
    },
    {
      id: 'arc-regen-001',
      name: 'Learning Arc Regeneration',
      category: 'arc_regeneration',
      template: `You are an instructional designer revising a learning arc based on client feedback.

CLIENT BRIEF:
- Client: {{clientName}}
- Industry: {{industry}}
- Objectives: {{objectives}}
- Audience: {{audience}}

CURRENT ARC:
{{currentArc}}

CLIENT FEEDBACK:
{{feedback}}

TASK:
Revise the learning arc to incorporate the feedback while maintaining a cohesive narrative structure.
Keep the same JSON structure but improve based on the feedback.`
    },
    {
      id: 'matrix-regen-001',
      name: 'Program Matrix Regeneration',
      category: 'matrix_regeneration',
      template: `You are an instructional designer revising a training program.

ORIGINAL PROGRAM:
{{originalMatrix}}

USER FEEDBACK:
{{feedback}}

TASK:
Revise the program based on the feedback. Maintain the same JSON structure but incorporate the requested changes.`
    },
    {
      id: 'sample-regen-001',
      name: 'Sample Content Regeneration',
      category: 'sample_regeneration',
      template: `You are a training content creator revising content based on client feedback.

CURRENT SAMPLE:
{{currentSample}}

SESSION REQUIREMENTS:
- Title: {{sessionTitle}}
- Objectives: {{sessionObjectives}}
- Topics: {{sessionTopics}}

CLIENT FEEDBACK:
{{feedback}}

TASK:
Revise the training content to incorporate the feedback while maintaining educational quality.
Keep the same JSON structure (article + quiz).`
    },
    {
      id: 'batch-gen-001',
      name: 'Batch Content Generation',
      category: 'batch_generation',
      template: `You are a training content creator generating a complete learning session.

CLIENT BRIEF:
- Client: {{clientName}}
- Industry: {{industry}}
- Audience: {{audience}}

LEARNING ARC CONTEXT:
- Overall Theme: {{arcTitle}}
- Narrative: {{arcNarrative}}
- Current Phase: {{currentPhase}}

SESSION TO CREATE:
- Session {{sessionNumber}}: {{sessionTitle}}
- Duration: {{sessionDuration}}
- Objectives: {{sessionObjectives}}
- Topics: {{sessionTopics}}
- Key Takeaways: {{sessionTakeaways}}

QUALITY TEMPLATE (match this style and quality):
Sample Article Length: {{sampleWordCount}} words
Sample Quiz Questions: {{sampleQuizCount}}
Sample Question Style: {{sampleQuestionStyle}}

TASK:
Create a complete training session with article and quiz that matches the approved sample's quality and style.

Return JSON with:
- article:
  - title: Engaging title for this session
  - content: Full article content (800-1200 words) with paragraphs, examples, practical tips
  - readingTime: Estimated reading time

- quiz:
  - questions: Array of {{sampleQuizCount}} multiple choice questions with:
    - question: The question text
    - options: Array of 4 answer choices
    - correctIndex: Index of correct answer (0-3)
    - explanation: Why this is correct (1-2 sentences)

Ensure content builds on previous sessions and aligns with the learning arc progression.`
    }
  ];
}

export async function seedPromptTemplates(): Promise<void> {
  const db = await getDatabase();
  const templates = getDefaultTemplates();

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
