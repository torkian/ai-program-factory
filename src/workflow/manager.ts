import {
  createSession,
  getSession,
  updateSession,
  saveSessionData,
  getSessionData,
  getAllSessionData,
  saveDecision,
  getDecisions,
  WorkflowSession
} from '../database/queries';

export type WorkflowStep =
  | 'brief'
  | 'route_selection'
  | 'route_a_upload'
  | 'content_review'        // NEW: Review extracted content
  | 'approach_selection_a'  // NEW: Choose approach for Route A
  | 'arc_generation'        // NEW: Generate learning arc
  | 'arc_review'            // NEW: Review learning arc
  | 'route_b_research'
  | 'approach_selection_b'  // Route B approach selection
  | 'matrix_generation'
  | 'matrix_review'
  | 'sample_generation'     // NEW: Generate sample article + quiz
  | 'sample_validation'     // NEW: Validate sample quality
  | 'batch_generation'
  | 'completed';

export interface WorkflowStateData {
  brief?: any;
  route?: 'A' | 'B';
  uploadedFiles?: any[];
  researchResults?: any;
  selectedApproach?: string;
  programMatrix?: any;
  sampleArticle?: any;
  allContent?: any;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export class WorkflowManager {
  /**
   * Create a new workflow session
   */
  async createWorkflowSession(clientName: string, industry: string): Promise<string> {
    const sessionId = generateId();
    await createSession(sessionId, clientName, industry);
    console.log(`Created workflow session: ${sessionId}`);
    return sessionId;
  }

  /**
   * Get current workflow session
   */
  async getWorkflowSession(sessionId: string): Promise<WorkflowSession> {
    return await getSession(sessionId);
  }

  /**
   * Update workflow to next step
   */
  async advanceToStep(sessionId: string, step: WorkflowStep): Promise<void> {
    await updateSession(sessionId, { current_step: step });
    console.log(`Advanced session ${sessionId} to step: ${step}`);
  }

  /**
   * Set the route for the workflow
   */
  async setRoute(sessionId: string, route: 'A' | 'B'): Promise<void> {
    await updateSession(sessionId, { route });
    await saveSessionData(sessionId, 'route', route);
    console.log(`Set route ${route} for session ${sessionId}`);
  }

  /**
   * Save step data
   */
  async saveStepData(sessionId: string, stepKey: string, data: any): Promise<void> {
    await saveSessionData(sessionId, stepKey, data);
    console.log(`Saved data for ${stepKey} in session ${sessionId}`);
  }

  /**
   * Get step data
   */
  async getStepData<T = any>(sessionId: string, stepKey: string): Promise<T | null> {
    return await getSessionData<T>(sessionId, stepKey);
  }

  /**
   * Get all data for a session
   */
  async getAllData(sessionId: string): Promise<WorkflowStateData> {
    const allData = await getAllSessionData(sessionId);
    return allData as WorkflowStateData;
  }

  /**
   * Record a human decision
   */
  async recordDecision(
    sessionId: string,
    step: string,
    decision: string,
    feedback?: string
  ): Promise<void> {
    const decisionId = generateId();
    await saveDecision(decisionId, sessionId, step, decision, feedback);
    console.log(`Recorded decision for ${step} in session ${sessionId}: ${decision}`);
  }

  /**
   * Get all decisions for a session
   */
  async getSessionDecisions(sessionId: string) {
    return await getDecisions(sessionId);
  }

  /**
   * Mark session as completed
   */
  async completeSession(sessionId: string): Promise<void> {
    await updateSession(sessionId, {
      status: 'completed',
      current_step: 'completed'
    });
    console.log(`Completed session ${sessionId}`);
  }

  /**
   * Determine next step based on current step and route
   */
  getNextStep(currentStep: WorkflowStep, route?: 'A' | 'B'): WorkflowStep {
    const stepFlow: Record<WorkflowStep, WorkflowStep | ((route?: 'A' | 'B') => WorkflowStep)> = {
      'brief': 'route_selection',
      'route_selection': (r) => r === 'A' ? 'route_a_upload' : 'route_b_research',

      // Route A flow
      'route_a_upload': 'content_review',
      'content_review': 'approach_selection_a',
      'approach_selection_a': 'arc_generation',
      'arc_generation': 'arc_review',
      'arc_review': 'matrix_generation',

      // Route B flow
      'route_b_research': 'approach_selection_b',
      'approach_selection_b': 'arc_generation',

      // Common flow
      'matrix_generation': 'matrix_review',
      'matrix_review': 'sample_generation',
      'sample_generation': 'sample_validation',
      'sample_validation': 'batch_generation',
      'batch_generation': 'completed',
      'completed': 'completed'
    };

    const next = stepFlow[currentStep];
    if (typeof next === 'function') {
      return next(route);
    }
    return next;
  }

  /**
   * Get user-friendly step names
   */
  getStepName(step: WorkflowStep): string {
    const stepNames: Record<WorkflowStep, string> = {
      'brief': 'Client Brief',
      'route_selection': 'Route Selection',
      'route_a_upload': 'Upload Materials',
      'content_review': 'Review Extracted Content',
      'approach_selection_a': 'Select Learning Approach',
      'arc_generation': 'Generate Learning Arc',
      'arc_review': 'Review Learning Arc',
      'route_b_research': 'Field Research',
      'approach_selection_b': 'Select Learning Approach',
      'matrix_generation': 'Generate Program Matrix',
      'matrix_review': 'Review Program Matrix',
      'sample_generation': 'Generate Sample Content',
      'sample_validation': 'Validate Sample Quality',
      'batch_generation': 'Generate All Content',
      'completed': 'Completed'
    };
    return stepNames[step] || step;
  }

  /**
   * Check if session can proceed (all required data present)
   */
  async canProceed(sessionId: string, currentStep: WorkflowStep): Promise<boolean> {
    const data = await this.getAllData(sessionId);

    switch (currentStep) {
      case 'brief':
        return !!data.brief;
      case 'route_selection':
        return !!data.route;
      case 'route_a_upload':
        return !!data.uploadedFiles && data.uploadedFiles.length > 0;
      case 'route_b_research':
        return !!data.researchResults;
      case 'approach_selection_a':
      case 'approach_selection_b':
        return !!data.selectedApproach;
      case 'matrix_generation':
        return !!data.programMatrix;
      case 'sample_generation':
        return !!data.sampleArticle;
      case 'sample_validation':
        return !!data.sampleArticle; // Requires approval
      default:
        return true;
    }
  }
}

// Export singleton instance
export const workflowManager = new WorkflowManager();
