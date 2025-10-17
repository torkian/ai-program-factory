import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface LearningArc {
  title: string;
  narrative: string;
  progression: {
    phase: string;
    focus: string;
  }[];
}

export class ArcGenerator {
  /**
   * Generate a learning arc based on content and selected approach
   */
  async generateArc(
    brief: any,
    extractedContent: string,
    approach: string,
    previousFeedback?: string
  ): Promise<LearningArc> {
    try {
      console.log('Generating learning arc...');

      const feedbackContext = previousFeedback
        ? `\n\nPREVIOUS FEEDBACK TO INCORPORATE:\n${previousFeedback}`
        : '';

      const prompt = `You are an instructional designer creating a narrative learning arc.

CLIENT BRIEF:
- Client: ${brief.clientName}
- Industry: ${brief.industry}
- Objectives: ${brief.objectives || 'General training'}
- Audience: ${brief.audience || 'General employees'}

SELECTED APPROACH: ${approach}

CONTENT OVERVIEW:
${extractedContent.substring(0, 4000)}${extractedContent.length > 4000 ? '...(truncated)' : ''}
${feedbackContext}

TASK:
Create a cohesive learning arc that structures the training material into a compelling narrative journey.

Return JSON with:
- title: A compelling title for the overall learning journey (5-8 words)
- narrative: A 2-3 sentence description of the overarching story/theme that connects all sessions
- progression: Array of 4-6 learning phases with:
  - phase: Phase name (e.g., "Foundation", "Application", "Mastery")
  - focus: What learners achieve in this phase (1 sentence)

The arc should create a sense of progression and purpose, not just a list of topics.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in learning design and instructional narrative. Create engaging, purposeful learning journeys.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return result as LearningArc;
    } catch (error) {
      console.error('Error generating arc:', error);
      return this.getFallbackArc(brief, approach);
    }
  }

  /**
   * Regenerate arc with user feedback
   */
  async regenerateArc(
    brief: any,
    extractedContent: string,
    approach: string,
    currentArc: LearningArc,
    feedback: string
  ): Promise<LearningArc> {
    try {
      console.log('Regenerating arc with feedback...');

      const prompt = `You are an instructional designer revising a learning arc based on client feedback.

CLIENT BRIEF:
- Client: ${brief.clientName}
- Industry: ${brief.industry}
- Objectives: ${brief.objectives || 'General training'}
- Audience: ${brief.audience || 'General employees'}

CURRENT ARC:
${JSON.stringify(currentArc, null, 2)}

CLIENT FEEDBACK:
${feedback}

TASK:
Revise the learning arc to incorporate the feedback while maintaining a cohesive narrative structure.
Keep the same JSON structure but improve based on the feedback.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in learning design. Revise learning arcs based on client feedback.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return result as LearningArc;
    } catch (error) {
      console.error('Error regenerating arc:', error);
      return currentArc; // Return original if regeneration fails
    }
  }

  /**
   * Fallback arc if API fails
   */
  private getFallbackArc(brief: any, approach: string): LearningArc {
    return {
      title: `Mastering ${brief.industry} Excellence`,
      narrative: `This learning journey takes you from foundational concepts to confident application, building your expertise step-by-step through ${approach.toLowerCase()} methodology.`,
      progression: [
        {
          phase: 'Foundation',
          focus: 'Build essential knowledge and understanding of core concepts'
        },
        {
          phase: 'Comprehension',
          focus: 'Deepen understanding through examples and context'
        },
        {
          phase: 'Application',
          focus: 'Apply knowledge to practical scenarios and real-world situations'
        },
        {
          phase: 'Integration',
          focus: 'Connect concepts and see the bigger picture'
        },
        {
          phase: 'Mastery',
          focus: 'Achieve confidence and competence in independent practice'
        }
      ]
    };
  }
}

export const arcGenerator = new ArcGenerator();
