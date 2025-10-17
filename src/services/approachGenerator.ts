import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface LearningApproach {
  id: string;
  name: string;
  description: string;
  methodology: string;
  bestFor: string[];
}

export class ApproachGenerator {
  /**
   * Generate learning approaches based on extracted content (Route A)
   */
  async generateApproachesFromContent(
    brief: any,
    extractedContent: string
  ): Promise<LearningApproach[]> {
    try {
      console.log('Generating learning approaches from content...');

      const prompt = `You are an instructional designer analyzing content to recommend learning approaches.

CLIENT BRIEF:
- Client: ${brief.clientName}
- Industry: ${brief.industry}
- Objectives: ${brief.objectives || 'General training'}
- Audience: ${brief.audience || 'General employees'}

CONTENT ANALYSIS:
${extractedContent.substring(0, 4000)}${extractedContent.length > 4000 ? '...(truncated)' : ''}

TASK:
Analyze the content and recommend 3 different learning approaches that would work well with this material.

Return JSON with:
- approaches: Array of 3 approach objects with:
  - id: Unique identifier (e.g., "scenario-based", "progressive-mastery", "problem-solving")
  - name: Approach name (3-5 words)
  - description: Clear description of the approach (2 sentences)
  - methodology: How it works (1 sentence)
  - bestFor: Array of 2-3 learner characteristics this approach suits (e.g., "Visual learners", "Experienced professionals")

Make approaches diverse and specifically suited to the content type and audience.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in learning design and instructional methodology. Recommend evidence-based learning approaches.'
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

      return result.approaches || this.getFallbackApproaches(brief);
    } catch (error) {
      console.error('Error generating approaches:', error);
      return this.getFallbackApproaches(brief);
    }
  }

  /**
   * Fallback approaches if API fails
   */
  private getFallbackApproaches(brief: any): LearningApproach[] {
    return [
      {
        id: 'scenario-based',
        name: 'Scenario-Based Learning',
        description: 'Learners engage with realistic workplace scenarios and case studies. Each concept is introduced through practical situations they\'ll encounter on the job.',
        methodology: 'Present concepts through real-world scenarios, then guide learners to apply knowledge in context.',
        bestFor: [
          'Experienced professionals',
          'Hands-on learners',
          'Those who prefer practical examples'
        ]
      },
      {
        id: 'progressive-mastery',
        name: 'Progressive Mastery',
        description: 'Content is structured in carefully sequenced stages, building from simple to complex. Learners master each level before advancing to the next.',
        methodology: 'Layer concepts progressively with checkpoints to ensure understanding before advancing.',
        bestFor: [
          'New learners in this field',
          'Systematic thinkers',
          'Those who prefer structured progression'
        ]
      },
      {
        id: 'problem-solving',
        name: 'Problem-Solving Framework',
        description: 'Learning is organized around solving key challenges in ' + (brief.industry || 'the field') + '. Concepts are introduced as tools to solve specific problems.',
        methodology: 'Present problems first, then teach concepts as solutions, encouraging critical thinking.',
        bestFor: [
          'Analytical thinkers',
          'Self-directed learners',
          'Those motivated by challenges'
        ]
      }
    ];
  }
}

export const approachGenerator = new ApproachGenerator();
