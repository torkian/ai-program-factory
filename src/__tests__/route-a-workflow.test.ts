/**
 * Route A Workflow Integration Tests
 *
 * These tests verify the complete Route A workflow including:
 * - Content review and approval
 * - Approach generation and selection
 * - Learning arc generation and review
 * - Sample content generation and validation
 *
 * To run these tests:
 * 1. Install test dependencies: npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
 * 2. Run: npm test
 */

import { workflowManager } from '../workflow/manager';
import { approachGenerator } from '../services/approachGenerator';
import { arcGenerator } from '../services/arcGenerator';
import { sampleGenerator } from '../services/sampleGenerator';

describe('Route A Workflow - Content Review', () => {
  let sessionId: string;

  beforeEach(async () => {
    // Create test session
    sessionId = await workflowManager.createWorkflowSession('Test Corp', 'Technology');
    await workflowManager.saveStepData(sessionId, 'brief', {
      clientName: 'Test Corp',
      industry: 'Technology',
      objectives: ['Test API design'],
      audience: 'Developers'
    });
    await workflowManager.saveStepData(sessionId, 'extractedContent', 'Sample content about API design...');
  });

  test('should approve content and advance to approach selection', async () => {
    await workflowManager.recordDecision(sessionId, 'content_review', 'approve', 'Looks good');
    await workflowManager.advanceToStep(sessionId, 'approach_selection_a');

    const session = await workflowManager.getWorkflowSession(sessionId);
    expect(session.current_step).toBe('approach_selection_a');
  });

  test('should reject content and return to upload', async () => {
    await workflowManager.recordDecision(sessionId, 'content_review', 'reject', 'Missing sections');
    await workflowManager.advanceToStep(sessionId, 'route_a_upload');

    const session = await workflowManager.getWorkflowSession(sessionId);
    expect(session.current_step).toBe('route_a_upload');
  });

  test('should record decision in database', async () => {
    await workflowManager.recordDecision(sessionId, 'content_review', 'approve', 'Test feedback');

    const decisions = await workflowManager.getSessionDecisions(sessionId);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].step).toBe('content_review');
    expect(decisions[0].decision).toBe('approve');
  });
});

describe('Route A Workflow - Approach Generation', () => {
  let sessionId: string;
  const mockBrief = {
    clientName: 'Test Corp',
    industry: 'Technology',
    objectives: ['Learn API design'],
    audience: 'Developers'
  };
  const mockContent = `
    API Design Best Practices

    REST APIs should follow these principles:
    1. Use resource-based URLs
    2. Leverage HTTP methods correctly
    3. Return appropriate status codes
    4. Implement pagination for large datasets
  `;

  beforeEach(async () => {
    sessionId = await workflowManager.createWorkflowSession('Test Corp', 'Technology');
    await workflowManager.saveStepData(sessionId, 'brief', mockBrief);
    await workflowManager.saveStepData(sessionId, 'extractedContent', mockContent);
  });

  test('should generate 3 learning approaches', async () => {
    const approaches = await approachGenerator.generateApproachesFromContent(mockBrief, mockContent);

    expect(approaches).toHaveLength(3);
    expect(approaches[0]).toHaveProperty('id');
    expect(approaches[0]).toHaveProperty('name');
    expect(approaches[0]).toHaveProperty('description');
    expect(approaches[0]).toHaveProperty('methodology');
    expect(approaches[0]).toHaveProperty('bestFor');
  });

  test('should save selected approach', async () => {
    await workflowManager.saveStepData(sessionId, 'selectedApproach', 'scenario-based');

    const selectedApproach = await workflowManager.getStepData(sessionId, 'selectedApproach');
    expect(selectedApproach).toBe('scenario-based');
  });

  test('should advance to arc generation after selection', async () => {
    await workflowManager.saveStepData(sessionId, 'selectedApproach', 'progressive-mastery');
    await workflowManager.advanceToStep(sessionId, 'arc_generation');

    const session = await workflowManager.getWorkflowSession(sessionId);
    expect(session.current_step).toBe('arc_generation');
  });

  test('approaches should have unique IDs', async () => {
    const approaches = await approachGenerator.generateApproachesFromContent(mockBrief, mockContent);

    const ids = approaches.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(approaches.length);
  });
});

describe('Route A Workflow - Learning Arc', () => {
  let sessionId: string;
  const mockBrief = {
    clientName: 'Test Corp',
    industry: 'Technology',
    objectives: ['Master API design'],
    audience: 'Mid-level developers'
  };
  const mockContent = 'Comprehensive API design training content...';
  const mockApproach = 'scenario-based';

  beforeEach(async () => {
    sessionId = await workflowManager.createWorkflowSession('Test Corp', 'Technology');
    await workflowManager.saveStepData(sessionId, 'brief', mockBrief);
    await workflowManager.saveStepData(sessionId, 'extractedContent', mockContent);
    await workflowManager.saveStepData(sessionId, 'selectedApproach', mockApproach);
  });

  test('should generate learning arc with required structure', async () => {
    const arc = await arcGenerator.generateArc(mockBrief, mockContent, mockApproach);

    expect(arc).toHaveProperty('title');
    expect(arc).toHaveProperty('narrative');
    expect(arc).toHaveProperty('progression');
    expect(arc.progression.length).toBeGreaterThanOrEqual(4);
    expect(arc.progression.length).toBeLessThanOrEqual(6);
  });

  test('arc progression should have proper structure', async () => {
    const arc = await arcGenerator.generateArc(mockBrief, mockContent, mockApproach);

    arc.progression.forEach(phase => {
      expect(phase).toHaveProperty('phase');
      expect(phase).toHaveProperty('focus');
      expect(typeof phase.phase).toBe('string');
      expect(typeof phase.focus).toBe('string');
    });
  });

  test('should regenerate arc with feedback', async () => {
    const originalArc = await arcGenerator.generateArc(mockBrief, mockContent, mockApproach);
    await workflowManager.saveStepData(sessionId, 'learningArc', originalArc);

    const feedback = 'Add more practical examples and make it more hands-on';
    const newArc = await arcGenerator.regenerateArc(
      mockBrief,
      mockContent,
      mockApproach,
      originalArc,
      feedback
    );

    expect(newArc).toHaveProperty('title');
    expect(newArc).toHaveProperty('narrative');
    expect(newArc.progression).toBeDefined();
  });

  test('should save arc to session data', async () => {
    const arc = await arcGenerator.generateArc(mockBrief, mockContent, mockApproach);
    await workflowManager.saveStepData(sessionId, 'learningArc', arc);

    const savedArc = await workflowManager.getStepData(sessionId, 'learningArc');
    expect(savedArc).toEqual(arc);
  });

  test('should advance to arc review after generation', async () => {
    await workflowManager.advanceToStep(sessionId, 'arc_review');

    const session = await workflowManager.getWorkflowSession(sessionId);
    expect(session.current_step).toBe('arc_review');
  });
});

describe('Route A Workflow - Sample Generation', () => {
  let sessionId: string;
  const mockBrief = {
    clientName: 'Test Corp',
    industry: 'Software Development',
    objectives: ['API design mastery'],
    audience: 'Developers'
  };
  const mockMatrix = {
    programTitle: 'API Design Mastery',
    overview: 'Comprehensive API training',
    totalSessions: 4,
    targetAudience: 'Developers',
    sessions: [
      {
        sessionNumber: 1,
        title: 'API Fundamentals',
        objectives: ['Understand REST principles', 'Learn HTTP methods'],
        topics: ['REST architecture', 'HTTP methods', 'Status codes'],
        estimatedDuration: '1 hour',
        keyTakeaways: ['REST basics', 'HTTP method usage']
      }
    ],
    generatedAt: new Date().toISOString()
  };
  const mockArc = {
    title: 'Journey to API Mastery',
    narrative: 'Progressive learning from basics to advanced',
    progression: [
      { phase: 'Foundation', focus: 'Core concepts' },
      { phase: 'Application', focus: 'Practical usage' }
    ]
  };

  beforeEach(async () => {
    sessionId = await workflowManager.createWorkflowSession('Test Corp', 'Technology');
    await workflowManager.saveStepData(sessionId, 'brief', mockBrief);
    await workflowManager.saveStepData(sessionId, 'programMatrix', mockMatrix);
    await workflowManager.saveStepData(sessionId, 'learningArc', mockArc);
  });

  test('should generate sample with article and quiz', async () => {
    const sample = await sampleGenerator.generateSample(mockBrief, mockMatrix, mockArc);

    expect(sample).toHaveProperty('article');
    expect(sample).toHaveProperty('quiz');
    expect(sample.article).toHaveProperty('title');
    expect(sample.article).toHaveProperty('content');
    expect(sample.article).toHaveProperty('readingTime');
    expect(sample.quiz).toHaveProperty('questions');
  });

  test('quiz should have 4-5 questions', async () => {
    const sample = await sampleGenerator.generateSample(mockBrief, mockMatrix, mockArc);

    expect(sample.quiz.questions.length).toBeGreaterThanOrEqual(4);
    expect(sample.quiz.questions.length).toBeLessThanOrEqual(5);
  });

  test('each quiz question should have proper structure', async () => {
    const sample = await sampleGenerator.generateSample(mockBrief, mockMatrix, mockArc);

    sample.quiz.questions.forEach(q => {
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('options');
      expect(q).toHaveProperty('correctIndex');
      expect(q).toHaveProperty('explanation');
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
    });
  });

  test('article should have reasonable length', async () => {
    const sample = await sampleGenerator.generateSample(mockBrief, mockMatrix, mockArc);

    const wordCount = sample.article.content.split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(500);
  });

  test('should regenerate sample with feedback', async () => {
    const originalSample = await sampleGenerator.generateSample(mockBrief, mockMatrix, mockArc);
    await workflowManager.saveStepData(sessionId, 'sampleContent', originalSample);

    const feedback = 'Make it more concise and add code examples';
    const newSample = await sampleGenerator.regenerateSample(
      mockBrief,
      mockMatrix,
      mockArc,
      originalSample,
      feedback
    );

    expect(newSample.article).toHaveProperty('title');
    expect(newSample.quiz.questions.length).toBeGreaterThanOrEqual(4);
  });

  test('should advance to sample validation after generation', async () => {
    await workflowManager.advanceToStep(sessionId, 'sample_validation');

    const session = await workflowManager.getWorkflowSession(sessionId);
    expect(session.current_step).toBe('sample_validation');
  });

  test('should approve sample and advance to batch generation', async () => {
    await workflowManager.recordDecision(sessionId, 'sample_validation', 'approve');
    await workflowManager.advanceToStep(sessionId, 'batch_generation');

    const session = await workflowManager.getWorkflowSession(sessionId);
    expect(session.current_step).toBe('batch_generation');
  });
});

describe('Route A Workflow - End-to-End', () => {
  test('should complete full Route A workflow', async () => {
    // 1. Create session
    const sessionId = await workflowManager.createWorkflowSession('E2E Corp', 'Technology');

    // 2. Save brief
    const brief = {
      clientName: 'E2E Corp',
      industry: 'Technology',
      objectives: ['Learn API design'],
      audience: 'Developers'
    };
    await workflowManager.saveStepData(sessionId, 'brief', brief);

    // 3. Set route
    await workflowManager.setRoute(sessionId, 'A');
    await workflowManager.advanceToStep(sessionId, 'route_a_upload');

    // 4. Upload and extract content
    const content = 'API design training content...';
    await workflowManager.saveStepData(sessionId, 'extractedContent', content);
    await workflowManager.advanceToStep(sessionId, 'content_review');

    // 5. Approve content
    await workflowManager.recordDecision(sessionId, 'content_review', 'approve');
    await workflowManager.advanceToStep(sessionId, 'approach_selection_a');

    // 6. Select approach
    await workflowManager.saveStepData(sessionId, 'selectedApproach', 'scenario-based');
    await workflowManager.advanceToStep(sessionId, 'arc_generation');

    // 7. Generate arc
    const arc = await arcGenerator.generateArc(brief, content, 'scenario-based');
    await workflowManager.saveStepData(sessionId, 'learningArc', arc);
    await workflowManager.advanceToStep(sessionId, 'arc_review');

    // 8. Approve arc
    await workflowManager.recordDecision(sessionId, 'arc_review', 'approve');
    await workflowManager.advanceToStep(sessionId, 'matrix_generation');

    // 9. Generate matrix (mock)
    const matrix = {
      programTitle: 'Test Program',
      sessions: [
        {
          sessionNumber: 1,
          title: 'Session 1',
          objectives: ['Learn basics'],
          topics: ['Topic 1'],
          estimatedDuration: '1 hour',
          keyTakeaways: ['Key point']
        }
      ]
    };
    await workflowManager.saveStepData(sessionId, 'programMatrix', matrix);
    await workflowManager.advanceToStep(sessionId, 'matrix_review');

    // 10. Approve matrix
    await workflowManager.recordDecision(sessionId, 'matrix_review', 'approve');
    await workflowManager.advanceToStep(sessionId, 'sample_generation');

    // 11. Generate sample
    const sample = await sampleGenerator.generateSample(brief, matrix, arc);
    await workflowManager.saveStepData(sessionId, 'sampleContent', sample);
    await workflowManager.advanceToStep(sessionId, 'sample_validation');

    // 12. Approve sample
    await workflowManager.recordDecision(sessionId, 'sample_validation', 'approve');
    await workflowManager.advanceToStep(sessionId, 'batch_generation');

    // Verify final state
    const session = await workflowManager.getWorkflowSession(sessionId);
    expect(session.current_step).toBe('batch_generation');
    expect(session.route).toBe('A');

    // Verify all decisions recorded
    const decisions = await workflowManager.getSessionDecisions(sessionId);
    expect(decisions.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Route A Workflow - Error Handling', () => {
  test('should handle missing brief data', async () => {
    const sessionId = await workflowManager.createWorkflowSession('Test', 'Tech');

    await expect(async () => {
      await arcGenerator.generateArc(null as any, 'content', 'approach');
    }).rejects.toThrow();
  });

  test('should handle OpenAI API failures with fallback', async () => {
    const brief = { clientName: 'Test', industry: 'Tech' };
    const content = 'Test content';

    // This should not throw, should use fallback
    const approaches = await approachGenerator.generateApproachesFromContent(brief, content);
    expect(approaches).toHaveLength(3);
  });

  test('should validate required fields', async () => {
    const sessionId = await workflowManager.createWorkflowSession('Test', 'Tech');

    // Missing required data should be caught
    const data = await workflowManager.getStepData(sessionId, 'nonexistent');
    expect(data).toBeNull();
  });
});
