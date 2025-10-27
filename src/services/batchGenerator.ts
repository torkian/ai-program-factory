import OpenAI from 'openai';
import { promptTemplateService, PromptCategory } from './promptTemplateService';
import { ProgramMatrix } from './matrixGenerator';
import { SampleContent } from './sampleGenerator';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Default prompt template
const DEFAULT_BATCH_GENERATION_PROMPT = `You are a training content creator generating a complete learning session.

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

Ensure content builds on previous sessions and aligns with the learning arc progression.`;

export interface SessionContent {
  sessionNumber: number;
  article: {
    title: string;
    content: string;
    readingTime: string;
  };
  quiz: {
    questions: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }[];
  };
}

export interface BatchContent {
  programTitle: string;
  totalSessions: number;
  sessions: SessionContent[];
  generatedAt: string;
  metadata: {
    clientName: string;
    industry: string;
    targetAudience: string;
  };
}

export class BatchGenerator {
  /**
   * Generate all training sessions (articles + quizzes) based on program matrix
   */
  async generateAllSessions(
    brief: any,
    programMatrix: ProgramMatrix,
    learningArc: any,
    approvedSample: SampleContent
  ): Promise<BatchContent> {
    console.log(`Starting batch generation for ${programMatrix.totalSessions} sessions...`);

    const sessions: SessionContent[] = [];

    // Generate content for each session across all chapters
    let sessionIndex = 0;
    for (const chapter of programMatrix.chapters) {
      for (const session of chapter.sessions) {
        const arcPhase = learningArc.progression[Math.min(sessionIndex, learningArc.progression.length - 1)];

      console.log(`Generating session ${session.sessionNumber}/${programMatrix.totalSessions}: ${session.title}`);

      try {
        const sessionContent = await this.generateSessionContent(
          brief,
          session,
          arcPhase,
          learningArc,
          approvedSample,
          sessionIndex === 0 // First session uses approved sample as template
        );

        sessions.push(sessionContent);
      } catch (error) {
        console.error(`Error generating session ${session.sessionNumber}:`, error);
        // Use fallback content for this session
        sessions.push(this.getFallbackSessionContent(session, sessionIndex === 0 ? approvedSample : null));
      }

        sessionIndex++;
      }
    }

    console.log(`Batch generation complete! Generated ${sessions.length} sessions.`);

    return {
      programTitle: programMatrix.programTitle,
      totalSessions: programMatrix.totalSessions,
      sessions,
      generatedAt: new Date().toISOString(),
      metadata: {
        clientName: brief.clientName,
        industry: brief.industry,
        targetAudience: programMatrix.targetAudience
      }
    };
  }

  /**
   * Generate content for a single session
   */
  private async generateSessionContent(
    brief: any,
    session: any,
    arcPhase: any,
    learningArc: any,
    approvedSample: SampleContent,
    useApprovedSample: boolean
  ): Promise<SessionContent> {
    // If this is the first session, use the approved sample
    if (useApprovedSample) {
      return {
        sessionNumber: session.sessionNumber,
        article: approvedSample.article,
        quiz: approvedSample.quiz
      };
    }

    // Load prompt template
    const promptTemplate = await promptTemplateService.getPrompt(
      PromptCategory.BATCH_GENERATION,
      DEFAULT_BATCH_GENERATION_PROMPT
    );

    const prompt = promptTemplateService.buildPrompt(promptTemplate, {
      clientName: brief.clientName,
      industry: brief.industry,
      audience: brief.audience || 'General employees',
      arcTitle: learningArc.title,
      arcNarrative: learningArc.narrative,
      currentPhase: `${arcPhase.phase} - ${arcPhase.focus}`,
      sessionNumber: session.sessionNumber,
      sessionTitle: session.title,
      sessionDuration: session.estimatedDuration,
      sessionObjectives: session.objectives.join(', '),
      sessionTopics: session.topics.join(', '),
      sessionTakeaways: session.keyTakeaways.join(', '),
      sampleWordCount: approvedSample.article.content.split(/\s+/).length,
      sampleQuizCount: approvedSample.quiz.questions.length,
      sampleQuestionStyle: approvedSample.quiz.questions[0].question.substring(0, 100) + '...'
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert training content creator. Write clear, engaging, educational content that matches the approved quality standard.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      sessionNumber: session.sessionNumber,
      article: result.article,
      quiz: result.quiz
    };
  }

  /**
   * Get fallback content if API fails
   */
  private getFallbackSessionContent(session: any, approvedSample: SampleContent | null): SessionContent {
    // If we have an approved sample and this is the first session, use it
    if (approvedSample && session.sessionNumber === 1) {
      return {
        sessionNumber: session.sessionNumber,
        article: approvedSample.article,
        quiz: approvedSample.quiz
      };
    }

    return {
      sessionNumber: session.sessionNumber,
      article: {
        title: session.title,
        content: `Session ${session.sessionNumber}: ${session.title}

Introduction
Welcome to ${session.title}. In this session, you'll explore the key concepts and practical applications related to this important topic.

Learning Objectives
${session.objectives.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n')}

Key Topics

${session.topics.map((topic: string, i: number) => `
${i + 1}. ${topic}

Understanding ${topic} is essential for achieving mastery in this area. This concept plays a crucial role in your overall learning journey and will be built upon in subsequent sessions.

Practical Application:
Consider how ${topic} applies to your daily work. Think about specific scenarios where you can implement these principles to improve outcomes and efficiency.
`).join('\n')}

Summary and Key Takeaways

Let's review the main points from this session:

${session.keyTakeaways.map((takeaway: string, i: number) => `• ${takeaway}`).join('\n')}

These takeaways form the foundation for the next phase of your learning. Take time to reflect on how you can apply these concepts in your role.

Next Steps
In the following session, we'll build on these foundations to explore more advanced concepts and practical applications. Be sure to review the materials and consider the quiz questions to reinforce your learning.`,
        readingTime: session.estimatedDuration
      },
      quiz: {
        questions: [
          {
            question: `What is the primary focus of ${session.title}?`,
            options: [
              session.objectives[0] || 'Understanding key concepts',
              'Memorizing technical specifications',
              'Completing certification requirements',
              'Managing team dynamics'
            ],
            correctIndex: 0,
            explanation: `The primary focus is ${session.objectives[0] || 'understanding key concepts'}, which forms the foundation for this session.`
          },
          {
            question: `Which of the following is a key topic covered in this session?`,
            options: [
              session.topics[0] || 'Core principles',
              'Unrelated advanced topics',
              'Administrative procedures',
              'Budget considerations'
            ],
            correctIndex: 0,
            explanation: `${session.topics[0] || 'Core principles'} is one of the main topics explored in this session.`
          },
          {
            question: `What is one of the key takeaways from this session?`,
            options: [
              session.keyTakeaways[0] || 'Understanding fundamental concepts',
              'Completing all paperwork',
              'Attending all meetings',
              'Memorizing all details'
            ],
            correctIndex: 0,
            explanation: `${session.keyTakeaways[0] || 'Understanding fundamental concepts'} is a primary takeaway that you should be able to apply.`
          },
          {
            question: `How does this session fit into the overall program?`,
            options: [
              'It builds on previous knowledge and prepares for advanced topics',
              'It is completely standalone',
              'It only covers administrative details',
              'It is optional supplementary material'
            ],
            correctIndex: 0,
            explanation: 'Each session is designed to build progressively, connecting previous learning to new concepts.'
          }
        ]
      }
    };
  }

  /**
   * Export batch content to various formats
   */
  async exportToJSON(batchContent: BatchContent): Promise<string> {
    return JSON.stringify(batchContent, null, 2);
  }

  /**
   * Export batch content to HTML format
   */
  async exportToHTML(batchContent: BatchContent): Promise<string> {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${batchContent.programTitle}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 { color: #667eea; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
        h2 { color: #764ba2; margin-top: 40px; }
        h3 { color: #667eea; margin-top: 30px; }
        .session { border: 2px solid #e1e5e9; padding: 30px; margin: 30px 0; border-radius: 8px; }
        .quiz { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px; }
        .question { margin: 20px 0; padding: 15px; background: white; border-radius: 6px; }
        .correct { color: #28a745; font-weight: bold; }
        .metadata { background: #f0f3ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>${batchContent.programTitle}</h1>

    <div class="metadata">
        <strong>Client:</strong> ${batchContent.metadata.clientName}<br>
        <strong>Industry:</strong> ${batchContent.metadata.industry}<br>
        <strong>Target Audience:</strong> ${batchContent.metadata.targetAudience}<br>
        <strong>Total Sessions:</strong> ${batchContent.totalSessions}<br>
        <strong>Generated:</strong> ${new Date(batchContent.generatedAt).toLocaleString()}
    </div>
`;

    batchContent.sessions.forEach(session => {
      html += `
    <div class="session">
        <h2>Session ${session.sessionNumber}: ${session.article.title}</h2>
        <p><em>Reading Time: ${session.article.readingTime}</em></p>

        <div class="article-content">
            ${session.article.content.split('\n').map(para => para.trim() ? `<p>${para}</p>` : '').join('\n')}
        </div>

        <div class="quiz">
            <h3>Quiz Questions</h3>
            ${session.quiz.questions.map((q, i) => `
            <div class="question">
                <p><strong>Question ${i + 1}:</strong> ${q.question}</p>
                <ol type="a">
                    ${q.options.map((opt, j) => `<li${j === q.correctIndex ? ' class="correct"' : ''}>${opt}${j === q.correctIndex ? ' ✓' : ''}</li>`).join('\n')}
                </ol>
                <p><em>Explanation: ${q.explanation}</em></p>
            </div>
            `).join('\n')}
        </div>
    </div>
`;
    });

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Export batch content to Markdown format
   */
  async exportToMarkdown(batchContent: BatchContent): Promise<string> {
    let markdown = `# ${batchContent.programTitle}\n\n`;
    markdown += `**Client:** ${batchContent.metadata.clientName}  \n`;
    markdown += `**Industry:** ${batchContent.metadata.industry}  \n`;
    markdown += `**Target Audience:** ${batchContent.metadata.targetAudience}  \n`;
    markdown += `**Total Sessions:** ${batchContent.totalSessions}  \n`;
    markdown += `**Generated:** ${new Date(batchContent.generatedAt).toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    batchContent.sessions.forEach(session => {
      markdown += `## Session ${session.sessionNumber}: ${session.article.title}\n\n`;
      markdown += `*Reading Time: ${session.article.readingTime}*\n\n`;
      markdown += `${session.article.content}\n\n`;
      markdown += `### Quiz Questions\n\n`;

      session.quiz.questions.forEach((q, i) => {
        markdown += `**Question ${i + 1}:** ${q.question}\n\n`;
        q.options.forEach((opt, j) => {
          markdown += `${String.fromCharCode(97 + j)}. ${opt}${j === q.correctIndex ? ' ✓ **Correct**' : ''}\n`;
        });
        markdown += `\n*Explanation:* ${q.explanation}\n\n`;
      });

      markdown += `---\n\n`;
    });

    return markdown;
  }
}

export const batchGenerator = new BatchGenerator();
