import OpenAI from 'openai';
import { promptTemplateService, PromptCategory } from './promptTemplateService';
import { ProgramChapter, ProgramSession } from './matrixGenerator';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface SessionDescription {
  title: string;
  shortDescription: string; // 1-2 sentences for catalogs
  fullDescription: string; // 3-4 paragraphs for course pages
  learningOutcomes: string[]; // What learners will be able to do
  duration: string;
}

export interface ChapterDescription {
  title: string;
  shortDescription: string;
  fullDescription: string;
  overallGoals: string[];
  sessionsIncluded: number;
}

// Default prompts
const DEFAULT_SESSION_DESCRIPTION_PROMPT = `You are a course catalog writer creating compelling session descriptions.

SESSION DETAILS:
- Title: {{sessionTitle}}
- Objectives: {{objectives}}
- Topics: {{topics}}
- Key Takeaways: {{keyTakeaways}}
- Duration: {{duration}}
- Content Outline: {{contentOutline}}

PROGRAM CONTEXT:
- Program: {{programTitle}}
- Industry: {{industry}}
- Audience: {{audience}}

TASK:
Create marketing-ready descriptions for this training session.

Return JSON with:
- title: Session title (as provided)
- shortDescription: 1-2 sentence teaser for course catalogs/lists
- fullDescription: 3-4 paragraph detailed description for course detail pages (what learners will learn, why it matters, how it's structured)
- learningOutcomes: Array of 3-4 specific outcomes (what learners will be able to DO after completing)
- duration: Duration as provided

Make it engaging and benefit-focused. Emphasize practical value.`;

const DEFAULT_CHAPTER_DESCRIPTION_PROMPT = `You are a course catalog writer creating compelling chapter descriptions.

CHAPTER DETAILS:
- Title: {{chapterTitle}}
- Description: {{chapterDescription}}
- Goals: {{chapterGoals}}
- Sessions: {{sessionTitles}}

PROGRAM CONTEXT:
- Program: {{programTitle}}
- Industry: {{industry}}
- Audience: {{audience}}

TASK:
Create marketing-ready descriptions for this training chapter.

Return JSON with:
- title: Chapter title (as provided)
- shortDescription: 1-2 sentence overview for quick reference
- fullDescription: 2-3 paragraph description explaining the chapter's purpose, what it covers, and its role in the overall program
- overallGoals: Array of 2-3 main goals learners will achieve
- sessionsIncluded: Number of sessions (as provided)

Emphasize how this chapter builds learner competence and confidence.`;

export class DescriptionGenerator {
  /**
   * Generate session description
   */
  async generateSessionDescription(
    session: ProgramSession,
    programContext: any
  ): Promise<SessionDescription> {
    try {
      const promptTemplate = await promptTemplateService.getPrompt(
        PromptCategory.SESSION_DESCRIPTION,
        DEFAULT_SESSION_DESCRIPTION_PROMPT
      );

      const prompt = promptTemplateService.buildPrompt(promptTemplate, {
        sessionTitle: session.title,
        objectives: session.objectives.join(', '),
        topics: session.topics.join(', '),
        keyTakeaways: session.keyTakeaways.join(', '),
        duration: session.estimatedDuration,
        contentOutline: session.contentOutline || 'Not specified',
        programTitle: programContext.programTitle || 'Training Program',
        industry: programContext.industry || 'General',
        audience: programContext.audience || 'Professionals'
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at writing compelling course descriptions that motivate learners.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        title: result.title || session.title,
        shortDescription: result.shortDescription || `Learn ${session.objectives[0] || 'key concepts'}.`,
        fullDescription: result.fullDescription || session.contentOutline || 'Comprehensive training session.',
        learningOutcomes: result.learningOutcomes || session.objectives,
        duration: result.duration || session.estimatedDuration
      };
    } catch (error) {
      console.error('Error generating session description:', error);
      return this.getFallbackSessionDescription(session);
    }
  }

  /**
   * Generate chapter description
   */
  async generateChapterDescription(
    chapter: ProgramChapter,
    programContext: any
  ): Promise<ChapterDescription> {
    try {
      const promptTemplate = await promptTemplateService.getPrompt(
        PromptCategory.CHAPTER_DESCRIPTION,
        DEFAULT_CHAPTER_DESCRIPTION_PROMPT
      );

      const prompt = promptTemplateService.buildPrompt(promptTemplate, {
        chapterTitle: chapter.title,
        chapterDescription: chapter.description,
        chapterGoals: chapter.goals.join(', '),
        sessionTitles: chapter.sessions.map(s => s.title).join(', '),
        programTitle: programContext.programTitle || 'Training Program',
        industry: programContext.industry || 'General',
        audience: programContext.audience || 'Professionals'
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at writing compelling course descriptions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        title: result.title || chapter.title,
        shortDescription: result.shortDescription || chapter.description,
        fullDescription: result.fullDescription || chapter.description,
        overallGoals: result.overallGoals || chapter.goals,
        sessionsIncluded: result.sessionsIncluded || chapter.sessions.length
      };
    } catch (error) {
      console.error('Error generating chapter description:', error);
      return this.getFallbackChapterDescription(chapter);
    }
  }

  private getFallbackSessionDescription(session: ProgramSession): SessionDescription {
    return {
      title: session.title,
      shortDescription: `Learn ${session.objectives[0] || 'key concepts'} in this ${session.estimatedDuration} session.`,
      fullDescription: session.contentOutline || `This session covers ${session.topics.join(', ')}. You'll learn to ${session.objectives.join(', and ')}.`,
      learningOutcomes: session.objectives,
      duration: session.estimatedDuration
    };
  }

  private getFallbackChapterDescription(chapter: ProgramChapter): ChapterDescription {
    return {
      title: chapter.title,
      shortDescription: chapter.description,
      fullDescription: `${chapter.description} This chapter includes ${chapter.sessions.length} sessions covering: ${chapter.sessions.map(s => s.title).join(', ')}.`,
      overallGoals: chapter.goals,
      sessionsIncluded: chapter.sessions.length
    };
  }
}

export const descriptionGenerator = new DescriptionGenerator();
