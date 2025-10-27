import OpenAI from 'openai';
import { promptTemplateService, PromptCategory } from './promptTemplateService';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface Framework {
  id: string;
  name: string;
  description: string;
  theoreticalBasis: string;
  approach: string;
  bestFor: string[];
  considerations: string[];
}

export interface FrameworkRecommendation {
  frameworks: Framework[];
  recommended: string; // ID of recommended framework
  reasoning: string;
}

// Default prompt template
const DEFAULT_FRAMEWORK_GENERATION_PROMPT = `You are an expert instructional designer and learning theorist.

CLIENT BRIEF:
- Client: {{clientName}}
- Industry: {{industry}}
- Business Context: {{businessContext}}
- Business Challenges: {{businessChallenges}}
- Learning Gap: {{learningGap}}
- Audience: {{audience}}
- Objectives: {{objectives}}
{{contentContext}}

TASK:
Analyze the brief and propose 3 different theoretical frameworks or conceptual angles that could be used to structure this training program.

These are NOT learning approaches (like scenario-based), but rather the THEORETICAL FRAMEWORK or ANGLE:
- Different schools of thought
- Different theoretical models or paradigms
- Different conceptual lenses
- Different frameworks from the field

For example, for sales training, frameworks might be:
- Consultative Selling Framework (Challenger, SPIN, etc.)
- Relationship-Based Selling Framework
- Value-Based Selling Framework

Return JSON with:
- frameworks: Array of 3 framework objects with:
  - id: Unique identifier (kebab-case)
  - name: Framework name (3-6 words)
  - description: Clear description of this framework (2-3 sentences)
  - theoreticalBasis: What theory/model it's based on (1-2 sentences)
  - approach: How it structures the learning (1-2 sentences)
  - bestFor: Array of 2-3 scenarios where this framework works best
  - considerations: Array of 2-3 things to be aware of with this framework

- recommended: ID of the recommended framework
- reasoning: 2-3 sentences explaining why this framework is recommended for this specific client

Make frameworks genuinely different, representing distinct schools of thought or conceptual approaches relevant to the industry and challenges.`;

export class FrameworkGenerator {
  /**
   * Generate framework options based on brief and optional content/research
   */
  async generateFrameworks(
    brief: any,
    contentOrResearch?: string
  ): Promise<FrameworkRecommendation> {
    try {
      console.log('Generating framework options...');

      // Load prompt template
      const promptTemplate = await promptTemplateService.getPrompt(
        PromptCategory.FRAMEWORK_GENERATION,
        DEFAULT_FRAMEWORK_GENERATION_PROMPT
      );

      const contentContext = contentOrResearch
        ? `\n\nCONTENT/RESEARCH CONTEXT:\n${contentOrResearch.substring(0, 2000)}`
        : '';

      const prompt = promptTemplateService.buildPrompt(promptTemplate, {
        clientName: brief.clientName,
        industry: brief.industry,
        businessContext: brief.businessContext || 'Not specified',
        businessChallenges: brief.businessChallenges || 'Not specified',
        learningGap: brief.learningGap || 'Not specified',
        audience: brief.audience || 'General employees',
        objectives: Array.isArray(brief.objectives)
          ? brief.objectives.join(', ')
          : brief.objectives || 'General training',
        contentContext
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in learning theory and instructional design frameworks. Recommend evidence-based theoretical frameworks that match the client\'s needs.'
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

      return {
        frameworks: result.frameworks || this.getFallbackFrameworks(brief),
        recommended: result.recommended || 'framework-1',
        reasoning: result.reasoning || 'Recommended based on industry best practices.'
      };
    } catch (error) {
      console.error('Error generating frameworks:', error);
      return this.getFallbackFrameworks(brief);
    }
  }

  /**
   * Fallback frameworks if API fails
   */
  private getFallbackFrameworks(brief: any): FrameworkRecommendation {
    return {
      frameworks: [
        {
          id: 'competency-based',
          name: 'Competency-Based Framework',
          description: 'Structures learning around specific competencies and skills that employees must demonstrate. Focus on measurable outcomes and performance criteria.',
          theoreticalBasis: 'Based on competency-based education theory, which emphasizes mastery of specific skills over time spent learning.',
          approach: 'Define clear competencies, create assessments for each, and provide learning paths that build toward demonstrated mastery.',
          bestFor: [
            'Organizations needing standardized skill levels',
            'Compliance-driven training',
            'Performance-based evaluation requirements'
          ],
          considerations: [
            'Requires clear competency definitions upfront',
            'Assessment design is critical',
            'May feel rigid if not implemented thoughtfully'
          ]
        },
        {
          id: 'problem-centered',
          name: 'Problem-Centered Framework',
          description: 'Organizes learning around solving real business problems that ' + (brief.clientName || 'the organization') + ' faces. Concepts are introduced as tools to solve specific challenges.',
          theoreticalBasis: 'Based on problem-based learning theory and adult learning principles (Knowles) that emphasize relevance and immediate application.',
          approach: 'Present authentic problems from the business context, guide learners to develop solutions, teach concepts as they become relevant to problem-solving.',
          bestFor: [
            'Experienced professionals who learn by doing',
            'Complex challenges requiring critical thinking',
            'Organizations facing specific business problems'
          ],
          considerations: [
            'Requires good understanding of actual business problems',
            'Less structured than other approaches',
            'Learners need some foundational knowledge'
          ]
        },
        {
          id: 'progressive-scaffolding',
          name: 'Progressive Scaffolding Framework',
          description: 'Builds knowledge systematically from fundamentals to advanced applications, with each level providing support structures that are gradually removed as learners gain confidence.',
          theoreticalBasis: 'Based on Vygotsky\'s Zone of Proximal Development and cognitive load theory, emphasizing guided progression.',
          approach: 'Start with heavily supported introductory content, progressively reduce scaffolding as learners demonstrate understanding, culminating in independent application.',
          bestFor: [
            'Mixed experience levels in audience',
            'Complex technical subjects',
            'Building new organizational capabilities'
          ],
          considerations: [
            'Requires careful sequencing',
            'May progress too slowly for experienced learners',
            'Need checkpoints to adjust scaffolding'
          ]
        }
      ],
      recommended: 'problem-centered',
      reasoning: `Problem-centered is recommended because the brief emphasizes business challenges and practical application in ${brief.industry || 'the industry'}. This framework directly addresses the stated challenges while engaging ${brief.audience || 'learners'} with relevant scenarios.`
    };
  }
}

export const frameworkGenerator = new FrameworkGenerator();
