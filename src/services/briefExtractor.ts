import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ExtractedBrief {
  clientName: string;
  industry: string;
  businessContext?: string;
  businessChallenges?: string;
  learningGap?: string;
  audience: string;
  objectives: string[];
  additionalContext?: string;
}

export class BriefExtractor {
  /**
   * Extract structured brief information from a document
   */
  async extractFromDocument(documentContent: string): Promise<ExtractedBrief> {
    try {
      console.log('Extracting brief information from document...');

      const prompt = `You are an expert at analyzing briefing documents and extracting key information.

BRIEFING DOCUMENT:
${documentContent.substring(0, 8000)}${documentContent.length > 8000 ? '\n\n...(content continues)' : ''}

TASK:
Extract and structure the key information from this briefing document into a standardized format.

Return JSON with:
- clientName: The client/organization name
- industry: The industry or sector
- businessContext: Description of the client's current business situation (2-3 sentences)
- businessChallenges: Specific business challenges or pain points they're facing (can be bullet points or paragraph)
- learningGap: What knowledge or skills gap needs to be filled (1-2 sentences)
- audience: Target audience for the training (be specific about roles and experience levels)
- objectives: Array of learning objectives (what learners should be able to DO)
- additionalContext: Any other relevant context, constraints, or requirements

If a field is not mentioned in the document, omit it or set it to an empty string.
Focus on extracting actual content from the document rather than making assumptions.`;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing training briefing documents and extracting structured information. Extract only what is explicitly stated in the document.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3 // Lower temperature for more accurate extraction
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        clientName: result.clientName || '',
        industry: result.industry || '',
        businessContext: result.businessContext || '',
        businessChallenges: result.businessChallenges || '',
        learningGap: result.learningGap || '',
        audience: result.audience || '',
        objectives: Array.isArray(result.objectives) ? result.objectives : [],
        additionalContext: result.additionalContext || ''
      };
    } catch (error) {
      console.error('Error extracting brief:', error);
      throw new Error('Failed to extract brief information from document');
    }
  }
}

export const briefExtractor = new BriefExtractor();
