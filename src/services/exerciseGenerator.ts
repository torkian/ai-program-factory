import OpenAI from 'openai';
import { promptTemplateService, PromptCategory } from './promptTemplateService';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ExerciseStep {
  actor: 'mentor' | 'learner';
  prompt: string;
  hints?: string[];
}

export interface InteractiveExercise {
  title: string;
  scenario: string;
  objective: string;
  steps: ExerciseStep[];
  successCriteria: string[];
  estimatedTime: string;
}

// Default prompt template
const DEFAULT_EXERCISE_PROMPT = `You are an interactive exercise designer creating practice activities.

SESSION DETAILS:
- Title: {{sessionTitle}}
- Objectives: {{objectives}}
- Topics: {{topics}}
- Industry: {{industry}}
- Audience: {{audience}}
- Business Context: {{businessContext}}

TASK:
Design an interactive chat-based practice exercise where learners apply what they learned.

EXERCISE STRUCTURE:
- Scenario: Realistic workplace situation from {{industry}}
- Objective: Specific skill/knowledge to practice
- Steps: Back-and-forth conversation (mentor asks, learner responds)
- Success Criteria: What demonstrates mastery

Return JSON with:
- title: Exercise title
- scenario: Detailed scenario description (2-3 sentences) that feels real
- objective: What skill they're practicing
- steps: Array of conversation steps alternating between mentor and learner:
  - actor: "mentor" or "learner"
  - prompt: What mentor asks OR what learner should think about
  - hints: Optional array of 2-3 hints for learners (only for learner steps)
- successCriteria: Array of 3-4 criteria that show they did it right
- estimatedTime: Time to complete (e.g., "10-15 minutes")

Make scenarios authentic to {{industry}} work and relevant to {{audience}}.
The exercise should feel like practicing with a supportive coach.`;

export class ExerciseGenerator {
  /**
   * Generate an interactive exercise for a session
   */
  async generateExercise(
    sessionTitle: string,
    sessionObjectives: string[],
    sessionTopics: string[],
    brief: any
  ): Promise<InteractiveExercise> {
    try {
      console.log(`Generating interactive exercise for: ${sessionTitle}`);

      // Load prompt template
      const promptTemplate = await promptTemplateService.getPrompt(
        PromptCategory.INTERACTIVE_EXERCISE,
        DEFAULT_EXERCISE_PROMPT
      );

      const prompt = promptTemplateService.buildPrompt(promptTemplate, {
        sessionTitle,
        objectives: sessionObjectives.join(', '),
        topics: sessionTopics.join(', '),
        industry: brief.industry || 'General',
        audience: brief.audience || 'Professionals',
        businessContext: brief.businessContext || 'Workplace environment'
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at designing interactive learning exercises. Create realistic, engaging practice scenarios.'
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
        title: result.title || `${sessionTitle} - Practice Exercise`,
        scenario: result.scenario || 'Practice applying the concepts you learned.',
        objective: result.objective || sessionObjectives[0] || 'Apply knowledge',
        steps: result.steps || this.getDefaultSteps(sessionTitle),
        successCriteria: result.successCriteria || sessionObjectives,
        estimatedTime: result.estimatedTime || '10-15 minutes'
      };
    } catch (error) {
      console.error('Error generating exercise:', error);
      return this.getFallbackExercise(sessionTitle, sessionObjectives);
    }
  }

  private getDefaultSteps(sessionTitle: string): ExerciseStep[] {
    return [
      {
        actor: 'mentor',
        prompt: `Let's practice what you learned in ${sessionTitle}. I'll present a scenario and you'll work through it.`
      },
      {
        actor: 'learner',
        prompt: 'Think about how you would approach this situation.',
        hints: [
          'Consider the key concepts from the session',
          'Think about the practical applications',
          'What steps would you take first?'
        ]
      },
      {
        actor: 'mentor',
        prompt: 'What would be your first step and why?'
      },
      {
        actor: 'learner',
        prompt: 'Explain your reasoning and approach.',
        hints: [
          'Reference specific concepts you learned',
          'Explain why this approach makes sense',
          'Consider potential challenges'
        ]
      }
    ];
  }

  private getFallbackExercise(
    sessionTitle: string,
    objectives: string[]
  ): InteractiveExercise {
    return {
      title: `${sessionTitle} - Practice Exercise`,
      scenario: `You're in a workplace situation where you need to apply the concepts from ${sessionTitle}. Work through this scenario to practice your skills.`,
      objective: objectives[0] || 'Apply session concepts',
      steps: this.getDefaultSteps(sessionTitle),
      successCriteria: objectives.length > 0 ? objectives : [
        'Demonstrates understanding of key concepts',
        'Applies knowledge to scenario',
        'Explains reasoning clearly'
      ],
      estimatedTime: '10-15 minutes'
    };
  }
}

export const exerciseGenerator = new ExerciseGenerator();
