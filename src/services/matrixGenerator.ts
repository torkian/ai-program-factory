import OpenAI from 'openai';
import { promptTemplateService, PromptCategory } from './promptTemplateService';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ProgramSession {
  sessionNumber: number;
  chapterNumber: number;
  title: string;
  objectives: string[];
  topics: string[];
  estimatedDuration: string;
  keyTakeaways: string[];
  contentOutline: string; // NEW: Detailed outline for content generation
  prerequisites?: string; // NEW: What learners should know before this session
}

export interface ProgramChapter {
  chapterNumber: number;
  title: string;
  description: string;
  goals: string[]; // 2-3 main goals for this chapter
  sessions: ProgramSession[];
}

export interface ProgramMatrix {
  programTitle: string;
  overview: string;
  totalChapters: number;
  totalSessions: number;
  targetAudience: string;
  chapters: ProgramChapter[]; // NEW: Chapters containing sessions
  generatedAt: string;
}

// Default prompt templates
const DEFAULT_MATRIX_FROM_CONTENT_PROMPT = `You are an instructional designer creating a training program structure.

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

Structure logically: Chapters progress from fundamentals to advanced; sessions within chapters build progressively.`;

const DEFAULT_MATRIX_REGENERATION_PROMPT = `You are an instructional designer revising a training program.

ORIGINAL PROGRAM:
{{originalMatrix}}

USER FEEDBACK:
{{feedback}}

TASK:
Revise the program based on the feedback. Maintain the same JSON structure but incorporate the requested changes.`;

export class MatrixGenerator {
  /**
   * Generate a program matrix from extracted content (Route A)
   */
  async generateFromContent(
    brief: any,
    extractedContent: string,
    learningArc?: any
  ): Promise<ProgramMatrix> {
    try {
      console.log('Generating matrix from extracted content...');

      // Load prompt template
      const promptTemplate = await promptTemplateService.getPrompt(
        PromptCategory.MATRIX_GENERATION_CONTENT,
        DEFAULT_MATRIX_FROM_CONTENT_PROMPT
      );

      const arcContext = learningArc
        ? `\n\nLEARNING ARC TO FOLLOW:\n- Title: ${learningArc.title}\n- Narrative: ${learningArc.narrative}\n- Progression: ${learningArc.progression.map((p: any, i: number) => `\n  ${i + 1}. ${p.phase}: ${p.focus}`).join('')}\n\nStructure the sessions to follow this narrative arc and progression.`
        : '';

      const contentPreview = extractedContent.substring(0, 8000) +
        (extractedContent.length > 8000 ? ' ...(truncated)' : '');

      const prompt = promptTemplateService.buildPrompt(promptTemplate, {
        clientName: brief.clientName,
        industry: brief.industry,
        objectives: Array.isArray(brief.objectives) ? brief.objectives.join(', ') : (brief.objectives || 'General training'),
        audience: brief.audience || 'General employees',
        businessContext: brief.businessContext || 'Not specified',
        businessChallenges: brief.businessChallenges || 'Not specified',
        learningGap: brief.learningGap || 'Not specified',
        contentPreview,
        arcContext,
        arcContextNote: learningArc ? ' following the learning arc narrative' : ''
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert instructional designer. Create well-structured, pedagogically sound training programs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      // Validate that result has chapters structure
      if (!result.chapters || !Array.isArray(result.chapters)) {
        console.warn('AI did not return chapters array, using fallback');
        return this.getFallbackMatrix(brief, 'content');
      }

      return {
        ...result,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating matrix from content:', error);
      // Return fallback matrix
      return this.getFallbackMatrix(brief, 'content');
    }
  }

  /**
   * Generate a program matrix from research results (Route B)
   */
  async generateFromResearch(
    brief: any,
    research: any,
    selectedApproach: string
  ): Promise<ProgramMatrix> {
    try {
      console.log('Generating matrix from research...');

      // Find the selected approach details
      const approach = research.approaches?.find((a: any) => a.id === selectedApproach);

      const prompt = `You are an instructional designer creating a training program structure.

CLIENT BRIEF:
- Client: ${brief.clientName}
- Industry: ${brief.industry}
- Objectives: ${brief.objectives || 'General training'}
- Audience: ${brief.audience || 'General employees'}

RESEARCH CONTEXT:
Latest Developments: ${research.latestDevelopments?.join(', ')}

SELECTED APPROACH: ${approach?.name || selectedApproach}
- Description: ${approach?.description || 'Standard approach'}
- Methodology: ${approach?.methodology || 'Structured learning'}
- Best For: ${approach?.bestFor?.join(', ') || 'General training'}

TASK:
Create a training program based on this research and approach. Return JSON with:
- programTitle: Concise program title
- overview: 2-3 sentence program description incorporating the selected approach
- totalSessions: Number of sessions (typically 3-8)
- targetAudience: Who this is for
- sessions: Array of session objects with:
  - sessionNumber: Session number
  - title: Session title
  - objectives: Array of 2-4 learning objectives
  - topics: Array of 3-6 topics covered
  - estimatedDuration: Duration (e.g., "45 minutes", "1 hour")
  - keyTakeaways: Array of 2-3 main takeaways

Apply the selected methodology and latest developments from the research.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert instructional designer. Create innovative, research-based training programs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      // Validate that result has chapters structure
      if (!result.chapters || !Array.isArray(result.chapters)) {
        console.warn('AI did not return chapters array, using fallback');
        return this.getFallbackMatrix(brief, 'research');
      }

      return {
        ...result,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating matrix from research:', error);
      return this.getFallbackMatrix(brief, 'research');
    }
  }

  /**
   * Regenerate matrix based on user feedback
   */
  async regenerateWithFeedback(
    originalMatrix: ProgramMatrix,
    feedback: string
  ): Promise<ProgramMatrix> {
    try {
      console.log('Regenerating matrix with feedback...');

      // Load prompt template
      const promptTemplate = await promptTemplateService.getPrompt(
        PromptCategory.MATRIX_REGENERATION,
        DEFAULT_MATRIX_REGENERATION_PROMPT
      );

      const prompt = promptTemplateService.buildPrompt(promptTemplate, {
        originalMatrix: JSON.stringify(originalMatrix, null, 2),
        feedback
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert instructional designer. Revise programs based on client feedback.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      // Validate that result has chapters structure
      if (!result.chapters || !Array.isArray(result.chapters)) {
        console.warn('AI did not return chapters array in regeneration, keeping original');
        return originalMatrix;
      }

      return {
        ...result,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error regenerating matrix:', error);
      return originalMatrix; // Return original if regeneration fails
    }
  }

  /**
   * Fallback matrix if API fails
   */
  private getFallbackMatrix(brief: any, source: 'content' | 'research'): ProgramMatrix {
    const industry = brief.industry || 'General';

    const sessions: ProgramSession[] = [
        {
          sessionNumber: 1,
          chapterNumber: 1,
          title: 'Foundations and Overview',
          objectives: [
            'Understand core concepts and terminology',
            'Recognize the importance of best practices',
            'Identify key areas of focus'
          ],
          topics: [
            'Introduction to key concepts',
            'Industry standards and regulations',
            'Common challenges and solutions',
            'Overview of the learning journey'
          ],
          estimatedDuration: '45 minutes',
          keyTakeaways: [
            'Core terminology and concepts',
            'Why these practices matter',
            'What to expect in the program'
          ],
          contentOutline: `Introduction to fundamental concepts in ${industry}. Covers key terminology, industry standards, and establishes baseline knowledge for the program.`
        },
        {
          sessionNumber: 2,
          chapterNumber: 1,
          title: 'Essential Skills and Techniques',
          objectives: [
            'Apply fundamental techniques',
            'Demonstrate practical skills',
            'Follow established procedures'
          ],
          topics: [
            'Step-by-step procedures',
            'Common tools and resources',
            'Practical examples',
            'Hands-on exercises'
          ],
          estimatedDuration: '1 hour',
          keyTakeaways: [
            'Key techniques and methods',
            'How to apply skills in practice',
            'Resources for continued learning'
          ],
          contentOutline: `Practical application of foundational concepts. Learners will follow step-by-step procedures and practice with hands-on exercises relevant to ${industry}.`,
          prerequisites: 'Understanding of core concepts from Session 1'
        },
        {
          sessionNumber: 3,
          chapterNumber: 2,
          title: 'Advanced Applications',
          objectives: [
            'Handle complex scenarios',
            'Make informed decisions',
            'Solve real-world problems'
          ],
          topics: [
            'Advanced concepts',
            'Case studies and scenarios',
            'Problem-solving strategies',
            'Decision-making frameworks'
          ],
          estimatedDuration: '1 hour',
          keyTakeaways: [
            'Advanced problem-solving skills',
            'When and how to apply different approaches',
            'Confidence in handling complexity'
          ],
          contentOutline: `Advanced concepts with real-world case studies. Focus on complex scenarios and decision-making in ${industry} context.`,
          prerequisites: 'Completion of foundational skills from Chapter 1'
        },
        {
          sessionNumber: 4,
          chapterNumber: 2,
          title: 'Implementation and Best Practices',
          objectives: [
            'Implement knowledge in daily work',
            'Maintain high standards',
            'Continue professional development'
          ],
          topics: [
            'Integration into workflow',
            'Quality assurance',
            'Continuous improvement',
            'Next steps and resources'
          ],
          estimatedDuration: '45 minutes',
          keyTakeaways: [
            'How to apply learning immediately',
            'Ongoing development resources',
            'Commitment to best practices'
          ],
          contentOutline: `Integration of all learned concepts into daily workflows. Focus on maintaining standards and continuous improvement in ${industry}.`,
          prerequisites: 'Advanced application skills from Session 3'
        }
      ];

    // Organize into chapters
    const chapter1Sessions = sessions.slice(0, 2);
    const chapter2Sessions = sessions.slice(2, 4);

    return {
      programTitle: `${industry} Training Program`,
      overview: `A comprehensive training program designed for ${brief.audience || 'employees'} covering essential ${industry.toLowerCase()} concepts and best practices.`,
      totalChapters: 2,
      totalSessions: 4,
      targetAudience: brief.audience || 'All employees',
      chapters: [
        {
          chapterNumber: 1,
          title: 'Foundations',
          description: `Introduces core concepts and terminology essential for ${industry.toLowerCase()} training. Establishes baseline knowledge.`,
          goals: [
            'Understand core concepts and terminology',
            'Build foundational knowledge'
          ],
          sessions: chapter1Sessions
        },
        {
          chapterNumber: 2,
          title: 'Application and Mastery',
          description: `Builds on foundations with advanced concepts and practical applications. Develops confidence and competence.`,
          goals: [
            'Apply knowledge to real-world scenarios',
            'Achieve mastery and confidence'
          ],
          sessions: chapter2Sessions
        }
      ],
      generatedAt: new Date().toISOString()
    };
  }
}

export const matrixGenerator = new MatrixGenerator();
