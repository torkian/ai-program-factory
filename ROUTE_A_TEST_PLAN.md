# Route A Testing Plan

This document outlines comprehensive tests for all Route A workflow steps.

## Prerequisites

To install test dependencies (when npm cache issue is resolved):
```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

Add to package.json:
```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch"
},
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "testMatch": ["**/__tests__/**/*.test.ts"]
}
```

## Test Coverage

### 1. Content Review Tests
- ✅ POST `/api/workflow/:sessionId/content/approve`
  - Should approve content and advance to approach_selection_a
  - Should record decision in database
  - Should accept optional feedback
  - Should return 400 if sessionId doesn't exist

- ✅ POST `/api/workflow/:sessionId/content/reject`
  - Should reject content and return to route_a_upload
  - Should record rejection decision
  - Should require feedback
  - Should clear extracted content (optional)

### 2. Approach Generation Tests
- ✅ POST `/api/workflow/:sessionId/approaches/generate`
  - Should generate 3 learning approaches from content
  - Should save approaches to session data
  - Should return array of approach objects with id, name, description, methodology, bestFor
  - Should return 400 if brief or extractedContent not found
  - Should handle OpenAI API errors gracefully with fallback

### 3. Approach Selection Tests
- ✅ POST `/api/workflow/:sessionId/approach/select`
  - Should save selected approach
  - Should record decision
  - Should advance to arc_generation
  - Should return 400 if approach is missing

### 4. Arc Generation Tests
- ✅ POST `/api/workflow/:sessionId/arc/generate`
  - Should generate learning arc with title, narrative, progression
  - Should use brief, extractedContent, and selectedApproach
  - Should save arc to session data
  - Should advance to arc_review
  - Should return 400 if required data missing
  - Should have 4-6 progression phases

### 5. Arc Review Tests
- ✅ POST `/api/workflow/:sessionId/arc/approve`
  - Should approve arc and advance to matrix_generation
  - Should record decision
  - Should accept optional feedback

- ✅ POST `/api/workflow/:sessionId/arc/regenerate`
  - Should regenerate arc with user feedback
  - Should keep same structure but incorporate changes
  - Should save updated arc
  - Should not advance workflow step
  - Should require feedback parameter

### 6. Matrix Generation Tests (Updated for Arc)
- ✅ POST `/api/workflow/:sessionId/matrix/generate` (Route A)
  - Should use learningArc in matrix generation
  - Should pass arc to matrixGenerator.generateFromContent()
  - Should structure sessions according to arc progression
  - Should handle missing arc gracefully (optional parameter)

### 7. Sample Generation Tests
- ✅ POST `/api/workflow/:sessionId/sample/generate`
  - Should generate sample article (800-1200 words)
  - Should generate 4-5 quiz questions
  - Should use first session from program matrix
  - Should include learningArc context
  - Should save sample to session data
  - Should advance to sample_validation
  - Should return 400 if brief, programMatrix, or learningArc missing

### 8. Sample Validation Tests
- ✅ POST `/api/workflow/:sessionId/sample/approve`
  - Should approve sample and advance to batch_generation
  - Should record decision
  - Should accept optional feedback

- ✅ POST `/api/workflow/:sessionId/sample/regenerate`
  - Should regenerate sample with feedback
  - Should maintain same structure
  - Should save updated sample
  - Should not advance workflow
  - Should require feedback parameter

### 9. End-to-End Route A Flow Test
- ✅ Complete workflow from upload to batch_generation
  - Create session with brief
  - Select Route A
  - Upload files
  - Approve content
  - Generate and select approach
  - Generate and approve arc
  - Generate and approve matrix
  - Generate and approve sample
  - Reach batch_generation step

### 10. Service Unit Tests

#### ArcGenerator Service
- ✅ generateArc() should create valid arc structure
- ✅ regenerateArc() should incorporate feedback
- ✅ Should handle API failures with fallback

#### SampleGenerator Service
- ✅ generateSample() should create article + quiz
- ✅ Quiz should have 4-5 questions with correct answers
- ✅ regenerateSample() should apply feedback
- ✅ Should handle API failures with fallback

#### ApproachGenerator Service
- ✅ generateApproachesFromContent() should return 3 approaches
- ✅ Each approach should have required fields
- ✅ Should analyze content appropriately
- ✅ Should handle API failures with fallback

## Manual Testing Checklist

### Quick Manual Test
1. Start server: `npm start`
2. Open browser: `http://localhost:8080/workflow.html`
3. Create session:
   - Client: "Test Corp"
   - Industry: "Technology"
   - Objectives: "Train developers on API design"
   - Audience: "Software engineers"
4. Select Route A
5. Upload a sample text file (create one with API design content)
6. Review extracted content → Approve
7. See 3 learning approaches → Select one
8. Review learning arc → Approve or request changes
9. Review program matrix → Approve
10. Generate sample → Review article and quiz
11. Approve sample → Should reach batch generation

### Expected Results
- Each step should advance automatically to the next
- All decisions should be recorded in database
- Regeneration should preserve data structure
- Feedback loops should work (reject, regenerate)
- No 400/500 errors throughout the flow

## Test Data

### Sample Brief
```json
{
  "clientName": "Tech Corp",
  "industry": "Software Development",
  "objectives": ["Teach API design best practices", "Improve code quality"],
  "audience": "Mid-level developers"
}
```

### Sample File Content (upload.txt)
```
API Design Best Practices

REST APIs are the backbone of modern web applications. Key principles include:

1. Resource-Based URLs
Use nouns, not verbs. Example: GET /users/123 not GET /getUser?id=123

2. HTTP Methods
- GET: Retrieve data
- POST: Create new resource
- PUT: Update existing resource
- DELETE: Remove resource

3. Status Codes
- 200 OK: Success
- 201 Created: Resource created
- 400 Bad Request: Invalid input
- 404 Not Found: Resource doesn't exist
- 500 Internal Server Error: Server error

4. Versioning
Include version in URL: /api/v1/users

5. Pagination
For large datasets: GET /users?page=1&limit=20

6. Error Handling
Return consistent error format with message and error code
```

## Automated Test Implementation

When Jest is installed, create `src/__tests__/route-a.test.ts`:

```typescript
import request from 'supertest';
import { app } from '../index';
import { workflowManager } from '../workflow/manager';

describe('Route A Workflow', () => {
  let sessionId: string;

  beforeAll(async () => {
    // Initialize test database
  });

  afterAll(async () => {
    // Cleanup
  });

  test('should create session with brief', async () => {
    const response = await request(app)
      .post('/api/workflow')
      .send({
        clientName: 'Test Corp',
        industry: 'Technology',
        brief: {
          clientName: 'Test Corp',
          industry: 'Technology',
          objectives: ['Test objectives'],
          audience: 'Developers'
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.sessionId).toBeDefined();
    sessionId = response.body.sessionId;
  });

  test('should approve content and advance', async () => {
    // Setup: add content to session
    await workflowManager.saveStepData(sessionId, 'extractedContent', 'Test content...');

    const response = await request(app)
      .post(`/api/workflow/${sessionId}/content/approve`)
      .send({ feedback: 'Looks good' });

    expect(response.status).toBe(200);
    expect(response.body.nextStep).toBe('approach_selection_a');
  });

  test('should generate approaches', async () => {
    const response = await request(app)
      .post(`/api/workflow/${sessionId}/approaches/generate`);

    expect(response.status).toBe(200);
    expect(response.body.approaches).toHaveLength(3);
    expect(response.body.approaches[0]).toHaveProperty('id');
    expect(response.body.approaches[0]).toHaveProperty('name');
  });

  test('should select approach and generate arc', async () => {
    const response = await request(app)
      .post(`/api/workflow/${sessionId}/approach/select`)
      .send({ approach: 'scenario-based' });

    expect(response.status).toBe(200);
    expect(response.body.nextStep).toBe('arc_generation');
  });

  test('should generate learning arc', async () => {
    const response = await request(app)
      .post(`/api/workflow/${sessionId}/arc/generate`);

    expect(response.status).toBe(200);
    expect(response.body.arc).toHaveProperty('title');
    expect(response.body.arc).toHaveProperty('narrative');
    expect(response.body.arc.progression).toBeDefined();
  });

  test('should approve arc', async () => {
    const response = await request(app)
      .post(`/api/workflow/${sessionId}/arc/approve`)
      .send({ feedback: 'Perfect' });

    expect(response.status).toBe(200);
    expect(response.body.nextStep).toBe('matrix_generation');
  });

  test('should generate sample content', async () => {
    // First generate matrix
    await request(app)
      .post(`/api/workflow/${sessionId}/matrix/generate`);

    const response = await request(app)
      .post(`/api/workflow/${sessionId}/sample/generate`);

    expect(response.status).toBe(200);
    expect(response.body.sample.article).toHaveProperty('title');
    expect(response.body.sample.quiz.questions).toHaveLength(4);
  });

  test('should approve sample and reach batch generation', async () => {
    const response = await request(app)
      .post(`/api/workflow/${sessionId}/sample/approve`)
      .send({ feedback: 'Great sample' });

    expect(response.status).toBe(200);
    expect(response.body.nextStep).toBe('batch_generation');
  });
});
```

## Performance Tests

- Arc generation should complete in < 10 seconds
- Sample generation should complete in < 60 seconds
- Approach generation should complete in < 5 seconds
- Each API endpoint should respond in < 3 seconds (excluding AI generation)

## Security Tests

- Invalid sessionId should return 400
- Missing required data should return 400
- SQL injection attempts should be prevented
- File upload should validate file types

## Edge Cases

- Empty feedback should be accepted (optional)
- Very long content (>100k words) should be truncated
- OpenAI API failures should use fallback content
- Concurrent requests to same session should be handled
- Regeneration should preserve session state
