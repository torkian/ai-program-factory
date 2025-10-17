import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SampleArticle {
  title: string;
  content: string;
  readingTime: string;
}

export interface SampleContent {
  article: SampleArticle;
  quiz: {
    questions: QuizQuestion[];
  };
}

export class SampleGenerator {
  /**
   * Generate a complete sample (article + quiz) for the first session
   */
  async generateSample(
    brief: any,
    programMatrix: any,
    learningArc: any,
    previousFeedback?: string
  ): Promise<SampleContent> {
    try {
      console.log('Generating sample article and quiz...');

      const firstSession = programMatrix.sessions[0];

      const feedbackContext = previousFeedback
        ? `\n\nPREVIOUS FEEDBACK TO INCORPORATE:\n${previousFeedback}`
        : '';

      const prompt = `You are a training content creator generating a complete learning session.

CLIENT BRIEF:
- Client: ${brief.clientName}
- Industry: ${brief.industry}
- Audience: ${brief.audience || 'General employees'}

LEARNING ARC:
- Title: ${learningArc.title}
- Narrative: ${learningArc.narrative}
- Current Phase: ${learningArc.progression[0].phase} - ${learningArc.progression[0].focus}

SESSION TO CREATE:
- Title: ${firstSession.title}
- Objectives: ${firstSession.objectives.join(', ')}
- Topics: ${firstSession.topics.join(', ')}
- Duration: ${firstSession.estimatedDuration}
- Key Takeaways: ${firstSession.keyTakeaways.join(', ')}
${feedbackContext}

TASK:
Create a complete training session with both article and quiz.

Return JSON with:
- article:
  - title: Engaging article title
  - content: Full article content (800-1200 words) formatted with paragraphs, bullet points, examples
  - readingTime: Estimated reading time (e.g., "8 minutes")

- quiz:
  - questions: Array of 4-5 multiple choice questions with:
    - question: The question text
    - options: Array of 4 answer choices
    - correctIndex: Index of correct answer (0-3)
    - explanation: Why this is correct (1-2 sentences)

Make the content engaging, practical, and aligned with the learning objectives.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert training content creator. Write clear, engaging, and educational content.'
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

      return result as SampleContent;
    } catch (error) {
      console.error('Error generating sample:', error);
      return this.getFallbackSample(brief, programMatrix);
    }
  }

  /**
   * Regenerate sample with user feedback
   */
  async regenerateSample(
    brief: any,
    programMatrix: any,
    learningArc: any,
    currentSample: SampleContent,
    feedback: string
  ): Promise<SampleContent> {
    try {
      console.log('Regenerating sample with feedback...');

      const firstSession = programMatrix.sessions[0];

      const prompt = `You are a training content creator revising content based on client feedback.

CURRENT SAMPLE:
${JSON.stringify(currentSample, null, 2)}

SESSION REQUIREMENTS:
- Title: ${firstSession.title}
- Objectives: ${firstSession.objectives.join(', ')}
- Topics: ${firstSession.topics.join(', ')}

CLIENT FEEDBACK:
${feedback}

TASK:
Revise the training content to incorporate the feedback while maintaining educational quality.
Keep the same JSON structure (article + quiz).`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert training content creator. Revise content based on client feedback.'
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

      return result as SampleContent;
    } catch (error) {
      console.error('Error regenerating sample:', error);
      return currentSample; // Return original if regeneration fails
    }
  }

  /**
   * Fallback sample if API fails
   */
  private getFallbackSample(brief: any, programMatrix: any): SampleContent {
    const firstSession = programMatrix.sessions[0];

    return {
      article: {
        title: firstSession.title,
        content: `Welcome to ${firstSession.title}

Introduction
This session introduces you to the fundamental concepts that form the foundation of your learning journey. Understanding these basics is crucial for building expertise in ${brief.industry}.

Key Concepts
${firstSession.topics.slice(0, 3).map((topic: string, i: number) => `
${i + 1}. ${topic}
Understanding ${topic} is essential because it provides the groundwork for more advanced concepts. In practical terms, this means you'll be able to recognize and apply these principles in real-world scenarios.
`).join('\n')}

Practical Application
These concepts aren't just theoretical - they have direct applications in your daily work. For example, when you encounter ${firstSession.topics[0]}, you'll be able to apply the frameworks we've discussed to make informed decisions.

Key Takeaways
${firstSession.keyTakeaways.map((takeaway: string, i: number) => `• ${takeaway}`).join('\n')}

Next Steps
In the following sessions, we'll build on these foundations to develop more advanced skills and understanding. Take time to review these concepts and consider how they apply to your work environment.`,
        readingTime: '8 minutes'
      },
      quiz: {
        questions: [
          {
            question: `What is the primary focus of ${firstSession.title}?`,
            options: [
              firstSession.objectives[0] || 'Building foundational knowledge',
              'Advanced problem-solving techniques',
              'Leadership development',
              'Technical troubleshooting'
            ],
            correctIndex: 0,
            explanation: `This session focuses on ${firstSession.objectives[0] || 'building foundational knowledge'}, which is essential before moving to advanced topics.`
          },
          {
            question: `Which of the following is a key topic covered in this session?`,
            options: [
              firstSession.topics[0] || 'Core concepts',
              'Unrelated advanced topics',
              'Management strategies',
              'Budget planning'
            ],
            correctIndex: 0,
            explanation: `${firstSession.topics[0] || 'Core concepts'} is one of the main topics we explore in this session.`
          },
          {
            question: 'Why is foundational knowledge important?',
            options: [
              'It enables understanding of advanced concepts',
              'It is not particularly important',
              'Only managers need it',
              'It only applies to new employees'
            ],
            correctIndex: 0,
            explanation: 'Foundational knowledge provides the base upon which all advanced skills and understanding are built.'
          },
          {
            question: `What is one of the key takeaways from this session?`,
            options: [
              firstSession.keyTakeaways[0] || 'Understanding core principles',
              'Memorizing all technical details',
              'Completing certifications',
              'Managing team dynamics'
            ],
            correctIndex: 0,
            explanation: `${firstSession.keyTakeaways[0] || 'Understanding core principles'} is a primary takeaway that will serve you throughout the program.`
          }
        ]
      }
    };
  }
}

export const sampleGenerator = new SampleGenerator();
