import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { workflowManager } from '../workflow/manager';
import { getAllSessions, deleteSession } from '../database/queries';
import { fileProcessor } from '../services/fileProcessor';
import { researchAgent } from '../services/researchAgent';
import { matrixGenerator } from '../services/matrixGenerator';
import { approachGenerator } from '../services/approachGenerator';
import { arcGenerator } from '../services/arcGenerator';
import { sampleGenerator } from '../services/sampleGenerator';
import { batchGenerator } from '../services/batchGenerator';
import { briefExtractor } from '../services/briefExtractor';
import { frameworkGenerator } from '../services/frameworkGenerator';

const router = Router();

// Configure multer for file uploads
// Use /tmp directory for Render compatibility (read-only filesystem)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : 'uploads';
    // Create directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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
 * Upload briefing document and extract information
 */
router.post('/brief/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing briefing document: ${file.originalname}`);

    // Process the uploaded file
    const processedFile = await fileProcessor.processFiles([file]);
    const documentContent = processedFile[0].extractedText;

    // Extract structured brief information using AI
    const extractedBrief = await briefExtractor.extractFromDocument(documentContent);

    // Clean up uploaded file
    await fileProcessor.cleanupFiles([file]);

    res.json({
      success: true,
      brief: extractedBrief,
      message: 'Briefing document processed successfully'
    });
  } catch (error: any) {
    console.error('Error processing briefing document:', error);
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
    await workflowManager.advanceToStep(sessionId, 'framework_selection');

    res.json({
      success: true,
      nextStep: 'framework_selection'
    });
  } catch (error: any) {
    console.error('Error saving brief:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate framework options
 */
router.post('/:sessionId/frameworks/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const brief = await workflowManager.getStepData(sessionId, 'brief');

    if (!brief) {
      return res.status(400).json({ error: 'Brief not found' });
    }

    const frameworks = await frameworkGenerator.generateFrameworks(brief);

    // Save frameworks
    await workflowManager.saveStepData(sessionId, 'frameworkOptions', frameworks);

    res.json({
      success: true,
      frameworks: frameworks.frameworks,
      recommended: frameworks.recommended,
      reasoning: frameworks.reasoning
    });
  } catch (error: any) {
    console.error('Error generating frameworks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Select framework
 */
router.post('/:sessionId/framework/select', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { frameworkId, feedback } = req.body;

    if (!frameworkId) {
      return res.status(400).json({ error: 'frameworkId is required' });
    }

    await workflowManager.saveStepData(sessionId, 'selectedFramework', frameworkId);
    await workflowManager.recordDecision(sessionId, 'framework_selection', frameworkId, feedback);
    await workflowManager.advanceToStep(sessionId, 'route_selection');

    res.json({
      success: true,
      nextStep: 'route_selection'
    });
  } catch (error: any) {
    console.error('Error selecting framework:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Request new framework options
 */
router.post('/:sessionId/frameworks/regenerate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    const brief = await workflowManager.getStepData(sessionId, 'brief');

    if (!brief) {
      return res.status(400).json({ error: 'Brief not found' });
    }

    // Regenerate with feedback context
    const enhancedBrief = {
      ...brief,
      additionalContext: (brief.additionalContext || '') + `\n\nUSER FEEDBACK ON PREVIOUS FRAMEWORKS: ${feedback}`
    };

    const frameworks = await frameworkGenerator.generateFrameworks(enhancedBrief);

    // Save new frameworks
    await workflowManager.saveStepData(sessionId, 'frameworkOptions', frameworks);

    res.json({
      success: true,
      frameworks: frameworks.frameworks,
      recommended: frameworks.recommended,
      reasoning: frameworks.reasoning
    });
  } catch (error: any) {
    console.error('Error regenerating frameworks:', error);
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

    // Advance to content review (NEW human decision point)
    await workflowManager.advanceToStep(sessionId, 'content_review');

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
      nextStep: 'content_review'
    });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Approve content (Route A - after upload)
 */
router.post('/:sessionId/content/approve', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    // Record approval decision
    await workflowManager.recordDecision(sessionId, 'content_review', 'approve', feedback);

    // Advance to approach selection
    await workflowManager.advanceToStep(sessionId, 'approach_selection_a');

    res.json({
      success: true,
      nextStep: 'approach_selection_a'
    });
  } catch (error: any) {
    console.error('Error approving content:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reject content (Route A - back to upload)
 */
router.post('/:sessionId/content/reject', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    // Record rejection decision
    await workflowManager.recordDecision(sessionId, 'content_review', 'reject', feedback);

    // Go back to upload step
    await workflowManager.advanceToStep(sessionId, 'route_a_upload');

    res.json({
      success: true,
      nextStep: 'route_a_upload'
    });
  } catch (error: any) {
    console.error('Error rejecting content:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate approaches for Route A
 */
router.post('/:sessionId/approaches/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const brief = await workflowManager.getStepData(sessionId, 'brief');
    const extractedContent = await workflowManager.getStepData(sessionId, 'extractedContent');

    if (!brief || !extractedContent) {
      return res.status(400).json({ error: 'Brief or content not found' });
    }

    const approaches = await approachGenerator.generateApproachesFromContent(brief, extractedContent);

    // Save approaches
    await workflowManager.saveStepData(sessionId, 'generatedApproaches', approaches);

    res.json({
      success: true,
      approaches
    });
  } catch (error: any) {
    console.error('Error generating approaches:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Select approach (Route A)
 */
router.post('/:sessionId/approach/select', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { approach, feedback } = req.body;

    if (!approach) {
      return res.status(400).json({ error: 'approach is required' });
    }

    await workflowManager.saveStepData(sessionId, 'selectedApproach', approach);
    await workflowManager.recordDecision(sessionId, 'approach_selection_a', approach, feedback);
    await workflowManager.advanceToStep(sessionId, 'arc_generation');

    res.json({
      success: true,
      nextStep: 'arc_generation'
    });
  } catch (error: any) {
    console.error('Error selecting approach:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate learning arc
 */
router.post('/:sessionId/arc/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const brief = await workflowManager.getStepData(sessionId, 'brief');
    const extractedContent = await workflowManager.getStepData(sessionId, 'extractedContent');
    const selectedApproach = await workflowManager.getStepData(sessionId, 'selectedApproach');

    if (!brief || !extractedContent || !selectedApproach) {
      return res.status(400).json({ error: 'Required data not found' });
    }

    const arc = await arcGenerator.generateArc(brief, extractedContent, selectedApproach);

    // Save arc
    await workflowManager.saveStepData(sessionId, 'learningArc', arc);
    await workflowManager.advanceToStep(sessionId, 'arc_review');

    res.json({
      success: true,
      arc,
      nextStep: 'arc_review'
    });
  } catch (error: any) {
    console.error('Error generating arc:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Approve learning arc
 */
router.post('/:sessionId/arc/approve', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    await workflowManager.recordDecision(sessionId, 'arc_review', 'approve', feedback);
    await workflowManager.advanceToStep(sessionId, 'matrix_generation');

    res.json({
      success: true,
      nextStep: 'matrix_generation'
    });
  } catch (error: any) {
    console.error('Error approving arc:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Regenerate learning arc with feedback
 */
router.post('/:sessionId/arc/regenerate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    const brief = await workflowManager.getStepData(sessionId, 'brief');
    const extractedContent = await workflowManager.getStepData(sessionId, 'extractedContent');
    const selectedApproach = await workflowManager.getStepData(sessionId, 'selectedApproach');
    const currentArc = await workflowManager.getStepData(sessionId, 'learningArc');

    if (!brief || !extractedContent || !selectedApproach || !currentArc) {
      return res.status(400).json({ error: 'Required data not found' });
    }

    const newArc = await arcGenerator.regenerateArc(
      brief,
      extractedContent,
      selectedApproach,
      currentArc,
      feedback
    );

    // Save updated arc
    await workflowManager.saveStepData(sessionId, 'learningArc', newArc);

    res.json({
      success: true,
      arc: newArc
    });
  } catch (error: any) {
    console.error('Error regenerating arc:', error);
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

    console.log(`Research request for session ${sessionId}, brief found:`, !!brief);

    if (!brief) {
      console.error(`Brief data not found for session ${sessionId}`);
      return res.status(400).json({ error: 'Brief data not found. Please complete the brief first.' });
    }

    console.log(`Conducting research for session ${sessionId}...`);

    // Conduct research using OpenAI web search
    const research = await researchAgent.conductResearch(brief);

    // Save research results
    await workflowManager.saveStepData(sessionId, 'researchResults', research);
    await workflowManager.advanceToStep(sessionId, 'approach_selection_b');

    res.json({
      success: true,
      research,
      nextStep: 'approach_selection_b'
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
    await workflowManager.recordDecision(sessionId, 'approach_selection_b', approach, feedback);
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
 * Generate program matrix (auto-generates based on route)
 */
router.post('/:sessionId/matrix/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log(`Matrix generation requested for session ${sessionId}`);

    // Get session route and data
    const session = await workflowManager.getWorkflowSession(sessionId);
    console.log(`Session found: ${session.id}, Route: ${session.route}, Step: ${session.current_step}`);

    const brief = await workflowManager.getStepData(sessionId, 'brief');
    console.log(`Brief data found:`, !!brief);

    if (!brief) {
      console.error(`Brief data not found for session ${sessionId}`);
      return res.status(400).json({ error: 'Brief data not found' });
    }

    console.log(`Generating matrix for session ${sessionId} (Route ${session.route})...`);

    let matrix;

    if (session.route === 'A') {
      // Generate from extracted content
      const extractedContent = await workflowManager.getStepData(sessionId, 'extractedContent');
      const learningArc = await workflowManager.getStepData(sessionId, 'learningArc');

      if (!extractedContent) {
        return res.status(400).json({ error: 'Extracted content not found' });
      }

      matrix = await matrixGenerator.generateFromContent(brief, extractedContent, learningArc);
    } else if (session.route === 'B') {
      // Generate from research
      const research = await workflowManager.getStepData(sessionId, 'researchResults');
      const selectedApproach = await workflowManager.getStepData(sessionId, 'selectedApproach');
      if (!research || !selectedApproach) {
        return res.status(400).json({ error: 'Research data not found' });
      }
      matrix = await matrixGenerator.generateFromResearch(brief, research, selectedApproach);
    } else {
      return res.status(400).json({ error: 'Invalid route' });
    }

    // Save generated matrix
    await workflowManager.saveStepData(sessionId, 'programMatrix', matrix);
    await workflowManager.advanceToStep(sessionId, 'matrix_review');

    res.json({
      success: true,
      matrix,
      nextStep: 'matrix_review'
    });
  } catch (error: any) {
    console.error('Error generating matrix:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Regenerate matrix with feedback
 */
router.post('/:sessionId/matrix/regenerate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    // Get current matrix
    const currentMatrix = await workflowManager.getStepData(sessionId, 'programMatrix');
    if (!currentMatrix) {
      return res.status(400).json({ error: 'No existing matrix found' });
    }

    console.log(`Regenerating matrix for session ${sessionId} with feedback...`);

    // Regenerate with feedback
    const newMatrix = await matrixGenerator.regenerateWithFeedback(currentMatrix, feedback);

    // Save updated matrix
    await workflowManager.saveStepData(sessionId, 'programMatrix', newMatrix);

    res.json({
      success: true,
      matrix: newMatrix
    });
  } catch (error: any) {
    console.error('Error regenerating matrix:', error);
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
      await workflowManager.advanceToStep(sessionId, 'sample_generation');
      res.json({
        success: true,
        nextStep: 'sample_generation'
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
 * Generate sample content (article + quiz)
 */
router.post('/:sessionId/sample/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const brief = await workflowManager.getStepData(sessionId, 'brief');
    const programMatrix = await workflowManager.getStepData(sessionId, 'programMatrix');
    const learningArc = await workflowManager.getStepData(sessionId, 'learningArc');

    if (!brief || !programMatrix || !learningArc) {
      return res.status(400).json({ error: 'Required data not found' });
    }

    const sample = await sampleGenerator.generateSample(brief, programMatrix, learningArc);

    // Save sample
    await workflowManager.saveStepData(sessionId, 'sampleContent', sample);
    await workflowManager.advanceToStep(sessionId, 'sample_validation');

    res.json({
      success: true,
      sample,
      nextStep: 'sample_validation'
    });
  } catch (error: any) {
    console.error('Error generating sample:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Approve sample content
 */
router.post('/:sessionId/sample/approve', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    await workflowManager.recordDecision(sessionId, 'sample_validation', 'approve', feedback);
    await workflowManager.advanceToStep(sessionId, 'batch_generation');

    res.json({
      success: true,
      nextStep: 'batch_generation'
    });
  } catch (error: any) {
    console.error('Error approving sample:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Regenerate sample with feedback
 */
router.post('/:sessionId/sample/regenerate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    const brief = await workflowManager.getStepData(sessionId, 'brief');
    const programMatrix = await workflowManager.getStepData(sessionId, 'programMatrix');
    const learningArc = await workflowManager.getStepData(sessionId, 'learningArc');
    const currentSample = await workflowManager.getStepData(sessionId, 'sampleContent');

    if (!brief || !programMatrix || !learningArc || !currentSample) {
      return res.status(400).json({ error: 'Required data not found' });
    }

    const newSample = await sampleGenerator.regenerateSample(
      brief,
      programMatrix,
      learningArc,
      currentSample,
      feedback
    );

    // Save updated sample
    await workflowManager.saveStepData(sessionId, 'sampleContent', newSample);

    res.json({
      success: true,
      sample: newSample
    });
  } catch (error: any) {
    console.error('Error regenerating sample:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save sample article (DEPRECATED - use /sample/generate instead)
 */
router.post('/:sessionId/sample', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sampleArticle = req.body;

    await workflowManager.saveStepData(sessionId, 'sampleArticle', sampleArticle);
    await workflowManager.advanceToStep(sessionId, 'sample_validation');

    res.json({
      success: true,
      nextStep: 'sample_validation'
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

    await workflowManager.recordDecision(sessionId, 'sample_validation', decision, feedback);

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
 * Generate all content (batch generation)
 */
router.post('/:sessionId/batch/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log(`Batch generation requested for session ${sessionId}`);

    // Get all required data
    const brief = await workflowManager.getStepData(sessionId, 'brief');
    const programMatrix = await workflowManager.getStepData(sessionId, 'programMatrix');
    const learningArc = await workflowManager.getStepData(sessionId, 'learningArc');
    const sampleContent = await workflowManager.getStepData(sessionId, 'sampleContent');

    if (!brief || !programMatrix || !learningArc || !sampleContent) {
      return res.status(400).json({ error: 'Required data not found' });
    }

    console.log(`Generating batch content for ${programMatrix.totalSessions} sessions...`);

    // Generate all sessions
    const batchContent = await batchGenerator.generateAllSessions(
      brief,
      programMatrix,
      learningArc,
      sampleContent
    );

    // Save batch content
    await workflowManager.saveStepData(sessionId, 'allContent', batchContent);
    await workflowManager.completeSession(sessionId);

    res.json({
      success: true,
      batchContent,
      totalSessions: batchContent.sessions.length,
      nextStep: 'completed'
    });
  } catch (error: any) {
    console.error('Error generating batch content:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Download batch content in specific format
 */
router.get('/:sessionId/batch/download/:format', async (req, res) => {
  try {
    const { sessionId, format } = req.params;

    const batchContent = await workflowManager.getStepData(sessionId, 'allContent');

    if (!batchContent) {
      return res.status(404).json({ error: 'Batch content not found' });
    }

    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'json':
        content = await batchGenerator.exportToJSON(batchContent);
        contentType = 'application/json';
        filename = `${batchContent.programTitle.replace(/[^a-z0-9]/gi, '_')}.json`;
        break;

      case 'html':
        content = await batchGenerator.exportToHTML(batchContent);
        contentType = 'text/html';
        filename = `${batchContent.programTitle.replace(/[^a-z0-9]/gi, '_')}.html`;
        break;

      case 'markdown':
      case 'md':
        content = await batchGenerator.exportToMarkdown(batchContent);
        contentType = 'text/markdown';
        filename = `${batchContent.programTitle.replace(/[^a-z0-9]/gi, '_')}.md`;
        break;

      default:
        return res.status(400).json({ error: 'Invalid format. Use json, html, or markdown' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error: any) {
    console.error('Error downloading batch content:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save final content and complete (DEPRECATED - use /batch/generate instead)
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
