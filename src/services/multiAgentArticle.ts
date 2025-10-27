import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ArticleWithMetadata {
  content: string;
  citations: Citation[];
  qualityScore: QualityScore;
  agentNotes: AgentNote[];
}

export interface Citation {
  id: string;
  text: string; // What was cited
  source: string; // Source identifier
  location: string; // Where in article (paragraph number or section)
}

export interface QualityScore {
  overall: number; // 0-100
  sourceAccuracy: number;
  narrativeQuality: number;
  businessRelevance: number;
  styleContinuity: number;
  factualAccuracy: number;
}

export interface AgentNote {
  agent: string;
  note: string;
  timestamp: string;
}

export class MultiAgentArticleCreator {
  /**
   * Create article using multi-agent pipeline
   */
  async createArticle(
    sessionTitle: string,
    sessionObjectives: string[],
    sessionTopics: string[],
    contentOutline: string,
    sourceContent: string, // Extracted content or research
    brief: any,
    previousArticles: string[] // For style continuity
  ): Promise<ArticleWithMetadata> {
    console.log(`Multi-agent article creation for: ${sessionTitle}`);

    const agentNotes: AgentNote[] = [];

    // Agent 1: Source Interpretation
    const sourceAnalysis = await this.sourceInterpretationAgent(
      sourceContent,
      sessionObjectives,
      sessionTopics,
      agentNotes
    );

    // Agent 2: Business Context Integration
    const businessIntegration = await this.businessContextAgent(
      sourceAnalysis,
      brief,
      agentNotes
    );

    // Agent 3: Narrative Flow
    const narrativeArticle = await this.narrativeAgent(
      businessIntegration,
      sessionTitle,
      contentOutline,
      brief.audience,
      previousArticles,
      agentNotes
    );

    // Agent 4: Fact Checker & Citation
    const citedArticle = await this.factCheckerAgent(
      narrativeArticle,
      sourceContent,
      agentNotes
    );

    // Agent 5: Quality Control
    const finalArticle = await this.qualityControlAgent(
      citedArticle,
      sessionObjectives,
      brief,
      previousArticles,
      agentNotes
    );

    return finalArticle;
  }

  /**
   * Agent 1: Source Interpretation
   * Extracts key concepts and teaching points from source material
   */
  private async sourceInterpretationAgent(
    sourceContent: string,
    objectives: string[],
    topics: string[],
    notes: AgentNote[]
  ): Promise<string> {
    const prompt = `You are the Source Interpretation Agent.

SOURCE MATERIAL:
${sourceContent.substring(0, 4000)}

SESSION REQUIREMENTS:
- Objectives: ${objectives.join(', ')}
- Topics: ${topics.join(', ')}

TASK:
Extract and organize the key concepts, facts, and teaching points from the source material that are relevant to these objectives and topics.

Return a structured analysis:
- Main concepts (3-5)
- Key facts and data points
- Important relationships between concepts
- Practical applications mentioned

Format as clear bullet points. This will be used by other agents to create the article.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing educational content and extracting key teaching points.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower for accuracy
      max_tokens: 2000
    });

    const analysis = response.choices[0].message.content || '';

    notes.push({
      agent: 'Source Interpretation',
      note: `Extracted ${analysis.split('\n').length} key points from source material`,
      timestamp: new Date().toISOString()
    });

    return analysis;
  }

  /**
   * Agent 2: Business Context Integration
   * Adds business challenges, real-world examples
   */
  private async businessContextAgent(
    sourceAnalysis: string,
    brief: any,
    notes: AgentNote[]
  ): Promise<string> {
    const prompt = `You are the Business Context Integration Agent.

SOURCE ANALYSIS:
${sourceAnalysis}

BUSINESS CONTEXT:
- Industry: ${brief.industry}
- Business Challenges: ${brief.businessChallenges || 'Not specified'}
- Learning Gap: ${brief.learningGap || 'Not specified'}
- Audience: ${brief.audience}
- Daily Work Context: ${brief.additionalContext || 'Not specified'}

TASK:
Enhance the source analysis by integrating business context:
- Connect each concept to specific ${brief.industry} scenarios
- Reference the business challenges they're facing
- Add examples that reflect ${brief.audience} daily work
- Show how learning addresses the knowledge gap

Return enhanced content with business context woven in. Keep the structure but add contextual examples and connections.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at making training content relevant to specific business contexts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.6,
      max_tokens: 2500
    });

    const enhanced = response.choices[0].message.content || sourceAnalysis;

    notes.push({
      agent: 'Business Context',
      note: `Integrated ${brief.industry} context and ${brief.audience} examples`,
      timestamp: new Date().toISOString()
    });

    return enhanced;
  }

  /**
   * Agent 3: Narrative Flow
   * Creates engaging, well-structured article
   */
  private async narrativeAgent(
    businessContent: string,
    title: string,
    outline: string,
    audience: string,
    previousArticles: string[],
    notes: AgentNote[]
  ): Promise<string> {
    const styleReference = previousArticles.length > 0
      ? `\n\nSTYLE REFERENCE (match this tone and structure):\n${previousArticles[0].substring(0, 1000)}...`
      : '';

    const prompt = `You are the Narrative Flow Agent.

CONTENT TO STRUCTURE:
${businessContent}

ARTICLE REQUIREMENTS:
- Title: ${title}
- Outline: ${outline}
- Audience: ${audience}
- Length: 800-1200 words
${styleReference}

TASK:
Transform this content into an engaging, well-structured training article.

STRUCTURE:
1. Opening (2-3 paragraphs) - Why this matters, what they'll learn
2. Main Content (5-7 paragraphs) - Core teaching organized logically
3. Practical Application (2-3 paragraphs) - How to use this
4. Key Takeaways (bullet list) - 3-5 main points

NARRATIVE STYLE:
- Engaging and conversational
- Progressive difficulty (start simple, build complexity)
- Use "you" to address learner
- Include transitions between sections
- ${previousArticles.length > 0 ? 'Match the style and tone of the reference' : 'Professional but accessible'}

Return the complete article as plain text (markdown formatting allowed for headings/lists).`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert training content writer. Create engaging, pedagogically sound articles.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    const article = response.choices[0].message.content || '';

    notes.push({
      agent: 'Narrative Flow',
      note: `Created ${article.split(/\s+/).length} word article with engaging narrative`,
      timestamp: new Date().toISOString()
    });

    return article;
  }

  /**
   * Agent 4: Fact Checker & Citation
   * Validates claims and adds source citations
   */
  private async factCheckerAgent(
    article: string,
    sourceContent: string,
    notes: AgentNote[]
  ): Promise<{ article: string; citations: Citation[] }> {
    const prompt = `You are the Fact Checking Agent.

ARTICLE TO VERIFY:
${article}

SOURCE MATERIAL:
${sourceContent.substring(0, 3000)}

TASK:
Review the article for factual accuracy and add citations where needed.

INSTRUCTIONS:
1. Identify all factual claims (statistics, processes, regulations, etc.)
2. Verify each claim against source material
3. Add citation markers: [Source: brief description]
4. Flag any claims not supported by source material
5. Return the article with citations added inline

Format citations as: "Concept explanation [Source: Industry standard XYZ]"

Return JSON with:
- article: The article with citations added inline
- citations: Array of citation objects with:
  - id: Citation identifier (C1, C2, etc.)
  - text: What was cited
  - source: Source description
  - location: Where in article (section name)
- warnings: Array of any unsupported claims found

If source material doesn't support a claim, add [VERIFY: claim needs validation] marker.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a meticulous fact-checker. Ensure all claims are supported and properly cited.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower for accuracy
      max_tokens: 3500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    const citations: Citation[] = (result.citations || []).map((c: any, idx: number) => ({
      id: c.id || `C${idx + 1}`,
      text: c.text || '',
      source: c.source || 'Source material',
      location: c.location || 'Unknown'
    }));

    notes.push({
      agent: 'Fact Checker',
      note: `Added ${citations.length} citations. ${result.warnings?.length || 0} claims flagged for verification`,
      timestamp: new Date().toISOString()
    });

    return {
      article: result.article || article,
      citations
    };
  }

  /**
   * Agent 5: Quality Control
   * Final review for style, level, continuity
   */
  private async qualityControlAgent(
    citedContent: { article: string; citations: Citation[] },
    objectives: string[],
    brief: any,
    previousArticles: string[],
    notes: AgentNote[]
  ): Promise<ArticleWithMetadata> {
    const prompt = `You are the Quality Control Agent. Final review before publication.

ARTICLE:
${citedContent.article}

QUALITY CRITERIA:
1. Learning Objectives Met: ${objectives.join(', ')}
2. Appropriate Level: ${brief.audience}
3. Style Continuity: ${previousArticles.length > 0 ? 'Must match previous articles' : 'Establish baseline'}
4. Business Relevance: Examples use ${brief.industry} context
5. Clear Structure: Logical flow, good transitions
6. Factual Accuracy: All claims cited or verifiable

TASK:
Review the article and score it on each criterion (0-100).
Make minor edits if needed to improve quality.

Return JSON with:
- article: Final article (with any minor improvements)
- qualityScore: Object with scores for:
  - overall (0-100)
  - sourceAccuracy (0-100)
  - narrativeQuality (0-100)
  - businessRelevance (0-100)
  - styleContinuity (0-100)
  - factualAccuracy (0-100)
- improvements: Array of improvements made
- warnings: Array of any remaining concerns

Only make improvements that are clearly beneficial. Don't over-edit.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a quality control expert for training content. Ensure excellence while preserving authorial voice.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 4000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    const qualityScore: QualityScore = {
      overall: result.qualityScore?.overall || 85,
      sourceAccuracy: result.qualityScore?.sourceAccuracy || 85,
      narrativeQuality: result.qualityScore?.narrativeQuality || 85,
      businessRelevance: result.qualityScore?.businessRelevance || 85,
      styleContinuity: result.qualityScore?.styleContinuity || 85,
      factualAccuracy: result.qualityScore?.factualAccuracy || 85
    };

    notes.push({
      agent: 'Quality Control',
      note: `Final score: ${qualityScore.overall}/100. ${result.improvements?.length || 0} improvements made`,
      timestamp: new Date().toISOString()
    });

    return {
      content: result.article || citedContent.article,
      citations: citedContent.citations,
      qualityScore,
      agentNotes: notes
    };
  }
}

export const multiAgentArticleCreator = new MultiAgentArticleCreator();
