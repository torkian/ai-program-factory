import OpenAI from 'openai';
import { promptTemplateService, PromptCategory } from './promptTemplateService';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface VideoScript {
  title: string;
  duration: string; // Estimated duration (e.g., "5 minutes")
  script: string; // Full narrator script
  estimatedWordCount: number;
}

// Default prompt template
const DEFAULT_VIDEO_SCRIPT_PROMPT = `You are a video script writer creating engaging narrator scripts for training videos.

SESSION CONTENT:
Title: {{sessionTitle}}
Article Content:
{{articleContent}}

SESSION CONTEXT:
- Duration Target: {{sessionDuration}}
- Audience: {{audience}}
- Industry: {{industry}}
- Key Objectives: {{objectives}}

TASK:
Create a video narrator script based on this article content.

SCRIPT REQUIREMENTS:
- Conversational, engaging tone (spoken language, not written)
- Short sentences that are easy to speak
- Duration: Approximately {{sessionDuration}} (assume ~150 words per minute speaking)
- Structure:
  1. Hook (10-15 seconds) - Grab attention with why this matters
  2. Core Content (70-80% of time) - Main teaching points from article
  3. Close (10-15 seconds) - Call to action or next steps
- Include natural pauses: [PAUSE] between major sections
- Avoid complex jargon - explain concepts simply
- Use "you" to address learner directly
- Include 1-2 relatable examples from {{industry}}

Return JSON with:
- title: Video title (same as session or slightly adapted)
- duration: Estimated duration (e.g., "5 minutes")
- script: Full narrator script as plain text with [PAUSE] markers
- estimatedWordCount: Approximate word count

The script should sound natural when read aloud, not like written text.`;

export class VideoScriptGenerator {
  /**
   * Generate a video script from article content
   */
  async generateScript(
    sessionTitle: string,
    articleContent: string,
    sessionDuration: string,
    brief: any
  ): Promise<VideoScript> {
    try {
      console.log(`Generating video script for: ${sessionTitle}`);

      // Load prompt template
      const promptTemplate = await promptTemplateService.getPrompt(
        PromptCategory.VIDEO_SCRIPT_GENERATION,
        DEFAULT_VIDEO_SCRIPT_PROMPT
      );

      const prompt = promptTemplateService.buildPrompt(promptTemplate, {
        sessionTitle,
        articleContent: articleContent.substring(0, 3000), // Limit for token usage
        sessionDuration,
        audience: brief.audience || 'General employees',
        industry: brief.industry || 'General',
        objectives: Array.isArray(brief.objectives)
          ? brief.objectives.join(', ')
          : brief.objectives || 'General learning'
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert video script writer. Create engaging, conversational narrator scripts for training videos.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        title: result.title || sessionTitle,
        duration: result.duration || sessionDuration,
        script: result.script || this.getFallbackScript(sessionTitle),
        estimatedWordCount: result.estimatedWordCount || result.script?.split(/\s+/).length || 0
      };
    } catch (error) {
      console.error('Error generating video script:', error);
      return this.getFallbackScript(sessionTitle);
    }
  }

  /**
   * Fallback script if generation fails
   */
  private getFallbackScript(sessionTitle: string): VideoScript {
    return {
      title: sessionTitle,
      duration: '3-5 minutes',
      script: `Welcome to ${sessionTitle}.

[PAUSE]

In this video, we'll explore the key concepts and practical applications you need to know.

[PAUSE]

Let's dive in and discover how you can apply these principles in your daily work.

[PAUSE]

Remember, the goal is to build your confidence and competence in this area. Take your time to practice and review the materials.

Thank you for watching!`,
      estimatedWordCount: 65
    };
  }
}

export const videoScriptGenerator = new VideoScriptGenerator();
