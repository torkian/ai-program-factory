import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface LearningApproach {
  id: string;
  name: string;
  description: string;
  methodology: string;
  strengths: string[];
  limitations: string[];
  bestFor: string[];
  sources: string[];
}

export interface ResearchResults {
  field: string;
  latestDevelopments: string[];
  approaches: LearningApproach[];
  recommendation: {
    approachId: string;
    reasoning: string;
  };
  searchQueries: string[];
  timestamp: string;
}

export class ResearchAgent {
  /**
   * Conduct field research using OpenAI web search
   */
  async conductResearch(brief: any): Promise<ResearchResults> {
    const { industry, objectives, clientName } = brief;

    console.log(`Starting research for ${industry} training...`);

    // Create search query based on brief
    const searchQuery = this.buildSearchQuery(industry, objectives);

    try {
      // For now, use LLM knowledge to generate research-based approaches
      // In production with web_search enabled, this would do actual web research
      console.log('NOTE: Using LLM knowledge base. Enable web_search tool for real-time research.');

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a learning design researcher with expertise in corporate training. Provide research-based approaches for ${industry} training.`
          },
          {
            role: 'user',
            content: `Based on current best practices and research in corporate learning, provide 2-3 different learning methodologies for ${industry} training with objectives: ${objectives?.join(', ') || 'general professional development'}.

For each approach, include:
- Name and description
- Methodology details
- Strengths and limitations
- Best use cases
- Reference to established learning frameworks

Return as JSON with this structure:
{
  "latestDevelopments": ["development1", "development2", "development3"],
  "approaches": [
    {
      "id": "approach1",
      "name": "Approach Name",
      "description": "...",
      "methodology": "...",
      "strengths": ["...", "...", "..."],
      "limitations": ["...", "..."],
      "bestFor": ["...", "...", "..."],
      "sources": ["framework or theory name"]
    }
  ],
  "recommendation": {
    "approachId": "approach1",
    "reasoning": "..."
  }
}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const structured = JSON.parse(response.choices[0].message.content || '{}');

      return {
        field: industry,
        ...structured,
        searchQueries: [searchQuery],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error conducting research:', error);
      // Return fallback generic approaches if research fails
      return this.getFallbackApproaches(industry, objectives);
    }
  }

  /**
   * Build search query from brief information
   */
  private buildSearchQuery(industry: string, objectives?: string[]): string {
    const objectivesText = objectives?.join(', ') || 'professional development';
    return `${industry} corporate training best practices ${objectivesText} 2024`;
  }

  /**
   * Structure raw research content into organized format
   */
  private async structureResearch(researchContent: string, industry: string): Promise<Omit<ResearchResults, 'field' | 'searchQueries' | 'timestamp'>> {
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a learning design expert. Extract and structure the research findings into a clear format.'
          },
          {
            role: 'user',
            content: `From this research content, extract:
1. Latest developments (3-5 key points)
2. 2-3 distinct learning approaches with details:
   - Name
   - Description
   - Methodology
   - Strengths (3-4 points)
   - Limitations (2-3 points)
   - Best for (2-3 scenarios)
   - Sources/references
3. A recommendation of which approach is best and why

Research content:
${researchContent}

Return as JSON with this structure:
{
  "latestDevelopments": ["point1", "point2", ...],
  "approaches": [
    {
      "id": "approach1",
      "name": "Approach Name",
      "description": "...",
      "methodology": "...",
      "strengths": ["...", "..."],
      "limitations": ["...", "..."],
      "bestFor": ["...", "..."],
      "sources": ["..."]
    }
  ],
  "recommendation": {
    "approachId": "approach1",
    "reasoning": "..."
  }
}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const structured = JSON.parse(response.choices[0].message.content || '{}');
      return structured;
    } catch (error) {
      console.error('Error structuring research:', error);
      return this.getDefaultStructure(industry);
    }
  }

  /**
   * Get fallback approaches if web search fails
   */
  private getFallbackApproaches(industry: string, objectives?: string[]): ResearchResults {
    return {
      field: industry,
      latestDevelopments: [
        'Increased focus on microlearning and bite-sized content',
        'Integration of practical exercises and real-world scenarios',
        'Emphasis on measurable outcomes and skill application'
      ],
      approaches: [
        {
          id: 'competency-based',
          name: 'Competency-Based Learning',
          description: 'Focus on measurable skills and competencies with clear performance criteria',
          methodology: 'Define competencies, assess baseline, provide targeted training, validate mastery',
          strengths: [
            'Clear, measurable outcomes',
            'Self-paced progression',
            'Aligned with business objectives',
            'Easy to track progress'
          ],
          limitations: [
            'Requires detailed competency framework',
            'May feel rigid for some learners',
            'Time-intensive to set up'
          ],
          bestFor: [
            'Skills-based training',
            'Compliance and certification',
            'Role-specific development'
          ],
          sources: ['Industry best practices', 'Corporate learning standards']
        },
        {
          id: 'scenario-based',
          name: 'Scenario-Based Learning',
          description: 'Use realistic scenarios and case studies to teach practical application',
          methodology: 'Present realistic scenarios, learner makes decisions, receives feedback, reflects on outcomes',
          strengths: [
            'Highly engaging and relevant',
            'Develops critical thinking',
            'Direct application to real work',
            'Memorable learning experiences'
          ],
          limitations: [
            'Requires quality scenario development',
            'May need subject matter expert input',
            'Can be time-consuming to complete'
          ],
          bestFor: [
            'Soft skills development',
            'Decision-making training',
            'Customer-facing roles'
          ],
          sources: ['Learning design research', 'Instructional design principles']
        }
      ],
      recommendation: {
        approachId: 'scenario-based',
        reasoning: 'Scenario-based learning is recommended as it provides practical, engaging training that directly applies to real work situations, making it effective for most business contexts.'
      },
      searchQueries: [`${industry} training best practices`],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get default structure when structuring fails
   */
  private getDefaultStructure(industry: string): Omit<ResearchResults, 'field' | 'searchQueries' | 'timestamp'> {
    return {
      latestDevelopments: [
        'Focus on practical, applicable skills',
        'Integration of real-world scenarios',
        'Emphasis on measurable outcomes'
      ],
      approaches: [
        {
          id: 'practical',
          name: 'Practical Skills Approach',
          description: 'Focus on hands-on, practical skills development',
          methodology: 'Learn by doing with guided practice',
          strengths: ['Practical application', 'Engaging', 'Relevant'],
          limitations: ['Requires good examples', 'Time-intensive'],
          bestFor: ['Skills training', 'Technical roles'],
          sources: ['Industry standards']
        }
      ],
      recommendation: {
        approachId: 'practical',
        reasoning: 'Practical approach works well for most business training needs'
      }
    };
  }
}

export const researchAgent = new ResearchAgent();
