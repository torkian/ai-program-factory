import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ProgramSession {
  sessionNumber: number;
  title: string;
  objectives: string[];
  topics: string[];
  estimatedDuration: string;
  keyTakeaways: string[];
}

export interface ProgramMatrix {
  programTitle: string;
  overview: string;
  totalSessions: number;
  targetAudience: string;
  sessions: ProgramSession[];
  generatedAt: string;
}

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

      const arcContext = learningArc
        ? `\n\nLEARNING ARC TO FOLLOW:\n- Title: ${learningArc.title}\n- Narrative: ${learningArc.narrative}\n- Progression: ${learningArc.progression.map((p: any, i: number) => `\n  ${i + 1}. ${p.phase}: ${p.focus}`).join('')}\n\nStructure the sessions to follow this narrative arc and progression.`
        : '';

      const prompt = `You are an instructional designer creating a training program structure.

CLIENT BRIEF:
- Client: ${brief.clientName}
- Industry: ${brief.industry}
- Objectives: ${brief.objectives || 'General training'}
- Audience: ${brief.audience || 'General employees'}

EXTRACTED CONTENT:
${extractedContent.substring(0, 8000)} ${extractedContent.length > 8000 ? '...(truncated)' : ''}
${arcContext}

TASK:
Analyze the extracted content and create a structured training program${learningArc ? ' following the learning arc narrative' : ''}. Return JSON with:
- programTitle: Concise program title
- overview: 2-3 sentence program description
- totalSessions: Number of sessions (typically 3-8)
- targetAudience: Who this is for
- sessions: Array of session objects with:
  - sessionNumber: Session number
  - title: Session title
  - objectives: Array of 2-4 learning objectives for this session
  - topics: Array of 3-6 topics covered
  - estimatedDuration: Duration (e.g., "45 minutes", "1 hour")
  - keyTakeaways: Array of 2-3 main takeaways

Structure the content logically, building from fundamentals to advanced concepts.`;

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

      const prompt = `You are an instructional designer revising a training program.

ORIGINAL PROGRAM:
${JSON.stringify(originalMatrix, null, 2)}

USER FEEDBACK:
${feedback}

TASK:
Revise the program based on the feedback. Maintain the same JSON structure but incorporate the requested changes.`;

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

    return {
      programTitle: `${industry} Training Program`,
      overview: `A comprehensive training program designed for ${brief.audience || 'employees'} covering essential ${industry.toLowerCase()} concepts and best practices.`,
      totalSessions: 4,
      targetAudience: brief.audience || 'All employees',
      sessions: [
        {
          sessionNumber: 1,
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
          ]
        },
        {
          sessionNumber: 2,
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
          ]
        },
        {
          sessionNumber: 3,
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
          ]
        },
        {
          sessionNumber: 4,
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
          ]
        }
      ],
      generatedAt: new Date().toISOString()
    };
  }
}

export const matrixGenerator = new MatrixGenerator();
