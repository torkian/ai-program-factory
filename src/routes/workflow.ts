import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { workflowManager } from '../workflow/manager';
import { getAllSessions, deleteSession } from '../database/queries';
import { fileProcessor } from '../services/fileProcessor';
import { researchAgent } from '../services/researchAgent';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /txt|pdf|docx|md/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/octet-stream';

    if (extname || mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only text, PDF, and DOCX files are allowed'));
    }
  }
});

/**
 * Get all workflow sessions
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new workflow session
 */
router.post('/', async (req, res) => {
  try {
    const { clientName, industry, brief } = req.body;

    if (!clientName || !industry) {
      return res.status(400).json({ error: 'clientName and industry are required' });
    }

    // Create session
    const sessionId = await workflowManager.createWorkflowSession(clientName, industry);

    // Save brief data if provided
    if (brief) {
      await workflowManager.saveStepData(sessionId, 'brief', brief);
      await workflowManager.advanceToStep(sessionId, 'route_selection');
    }

    const session = await workflowManager.getWorkflowSession(sessionId);

    res.json({
      sessionId,
      session,
      nextStep: brief ? 'route_selection' : 'brief'
    });
  } catch (error: any) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get workflow session details
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await workflowManager.getWorkflowSession(sessionId);
    const data = await workflowManager.getAllData(sessionId);
    const decisions = await workflowManager.getSessionDecisions(sessionId);

    res.json({
      session,
      data,
      decisions,
      currentStepName: workflowManager.getStepName(session.current_step as any)
    });
  } catch (error: any) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a workflow session
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log(`Deleting session: ${sessionId}`);
    await deleteSession(sessionId);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save client brief
 */
router.post('/:sessionId/brief', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const brief = req.body;

    await workflowManager.saveStepData(sessionId, 'brief', brief);
    await workflowManager.advanceToStep(sessionId, 'route_selection');

    res.json({
      success: true,
      nextStep: 'route_selection'
    });
  } catch (error: any) {
    console.error('Error saving brief:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Select route (A or B)
 */
router.post('/:sessionId/route', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { route } = req.body;

    if (route !== 'A' && route !== 'B') {
      return res.status(400).json({ error: 'route must be A or B' });
    }

    await workflowManager.setRoute(sessionId, route);
    await workflowManager.recordDecision(sessionId, 'route_selection', route);

    const nextStep = route === 'A' ? 'route_a_upload' : 'route_b_research';
    await workflowManager.advanceToStep(sessionId, nextStep);

    res.json({
      success: true,
      route,
      nextStep
    });
  } catch (error: any) {
    console.error('Error setting route:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload files for Route A
 */
router.post('/:sessionId/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Processing ${files.length} files for session ${sessionId}`);

    // Process all uploaded files
    const processedFiles = await fileProcessor.processFiles(files);

    // Combine all documents into one training material
    const combinedContent = fileProcessor.combineDocuments(processedFiles);
    const analysis = fileProcessor.analyzeContent(combinedContent);

    // Save processed data
    await workflowManager.saveStepData(sessionId, 'uploadedFiles', processedFiles.map(f => ({
      originalName: f.originalName,
      size: f.size,
      wordCount: f.wordCount
    })));
    await workflowManager.saveStepData(sessionId, 'extractedContent', combinedContent);
    await workflowManager.saveStepData(sessionId, 'contentAnalysis', analysis);

    // Clean up uploaded files from disk
    await fileProcessor.cleanupFiles(files);

    // Advance to matrix generation
    await workflowManager.advanceToStep(sessionId, 'matrix_generation');

    res.json({
      success: true,
      filesCount: files.length,
      analysis: {
        totalWords: analysis.totalWords,
        estimatedReadingTime: analysis.estimatedReadingTime,
        documents: processedFiles.map(f => ({
          name: f.originalName,
          wordCount: f.wordCount
        }))
      },
      nextStep: 'matrix_generation'
    });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Conduct research for Route B
 */
router.post('/:sessionId/research', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get the brief data
    const brief = await workflowManager.getStepData(sessionId, 'brief');

    if (!brief) {
      return res.status(400).json({ error: 'Brief data not found. Please complete the brief first.' });
    }

    console.log(`Conducting research for session ${sessionId}...`);

    // Conduct research using OpenAI web search
    const research = await researchAgent.conductResearch(brief);

    // Save research results
    await workflowManager.saveStepData(sessionId, 'researchResults', research);
    await workflowManager.advanceToStep(sessionId, 'approach_selection');

    res.json({
      success: true,
      research,
      nextStep: 'approach_selection'
    });
  } catch (error: any) {
    console.error('Error conducting research:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Select approach (Route B)
 */
router.post('/:sessionId/approach', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { approach, feedback } = req.body;

    if (!approach) {
      return res.status(400).json({ error: 'approach is required' });
    }

    await workflowManager.saveStepData(sessionId, 'selectedApproach', approach);
    await workflowManager.recordDecision(sessionId, 'approach_selection', approach, feedback);
    await workflowManager.advanceToStep(sessionId, 'matrix_generation');

    res.json({
      success: true,
      nextStep: 'matrix_generation'
    });
  } catch (error: any) {
    console.error('Error selecting approach:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save program matrix
 */
router.post('/:sessionId/matrix', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const matrix = req.body;

    await workflowManager.saveStepData(sessionId, 'programMatrix', matrix);
    await workflowManager.advanceToStep(sessionId, 'matrix_review');

    res.json({
      success: true,
      nextStep: 'matrix_review'
    });
  } catch (error: any) {
    console.error('Error saving matrix:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Review and approve matrix
 */
router.post('/:sessionId/matrix/review', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { decision, feedback } = req.body;

    await workflowManager.recordDecision(sessionId, 'matrix_review', decision, feedback);

    if (decision === 'approve') {
      await workflowManager.advanceToStep(sessionId, 'sample_article');
      res.json({
        success: true,
        nextStep: 'sample_article'
      });
    } else {
      res.json({
        success: true,
        nextStep: 'matrix_generation',
        message: 'Please regenerate matrix with feedback'
      });
    }
  } catch (error: any) {
    console.error('Error reviewing matrix:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save sample article
 */
router.post('/:sessionId/sample', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sampleArticle = req.body;

    await workflowManager.saveStepData(sessionId, 'sampleArticle', sampleArticle);
    await workflowManager.advanceToStep(sessionId, 'article_validation');

    res.json({
      success: true,
      nextStep: 'article_validation'
    });
  } catch (error: any) {
    console.error('Error saving sample article:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Validate sample article
 */
router.post('/:sessionId/sample/validate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { decision, feedback } = req.body;

    await workflowManager.recordDecision(sessionId, 'article_validation', decision, feedback);

    if (decision === 'approve') {
      await workflowManager.advanceToStep(sessionId, 'batch_generation');
      res.json({
        success: true,
        nextStep: 'batch_generation'
      });
    } else {
      res.json({
        success: true,
        nextStep: 'sample_article',
        message: 'Please regenerate sample with feedback'
      });
    }
  } catch (error: any) {
    console.error('Error validating sample:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save final content and complete
 */
router.post('/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;

    await workflowManager.saveStepData(sessionId, 'allContent', content);
    await workflowManager.completeSession(sessionId);

    res.json({
      success: true,
      message: 'Workflow completed successfully'
    });
  } catch (error: any) {
    console.error('Error completing workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router };
