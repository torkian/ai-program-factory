import {
  getPromptTemplateByCategory,
  createPromptTemplate,
  updatePromptTemplate,
  getAllPromptTemplates,
  getPromptTemplate
} from '../database/queries';

// Prompt template categories
export enum PromptCategory {
  FRAMEWORK_GENERATION = 'framework_generation',
  APPROACH_GENERATION_CONTENT = 'approach_generation_content',
  APPROACH_GENERATION_RESEARCH = 'approach_generation_research',
  ARC_GENERATION = 'arc_generation',
  ARC_REGENERATION = 'arc_regeneration',
  MATRIX_GENERATION_CONTENT = 'matrix_generation_content',
  MATRIX_GENERATION_RESEARCH = 'matrix_generation_research',
  MATRIX_REGENERATION = 'matrix_regeneration',
  SAMPLE_GENERATION = 'sample_generation',
  SAMPLE_REGENERATION = 'sample_regeneration',
  BATCH_GENERATION = 'batch_generation',
  VIDEO_SCRIPT_GENERATION = 'video_script_generation',
  SESSION_DESCRIPTION = 'session_description',
  CHAPTER_DESCRIPTION = 'chapter_description',
  INTERACTIVE_EXERCISE = 'interactive_exercise'
}

export class PromptTemplateService {
  private cache: Map<string, string> = new Map();

  /**
   * Get a prompt template by category
   * Returns from cache if available, otherwise loads from database
   * Falls back to provided default if not found
   */
  async getPrompt(category: PromptCategory, defaultPrompt: string): Promise<string> {
    // Check cache first
    const cacheKey = category;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Load from database
      const template = await getPromptTemplateByCategory(category);

      if (template && template.is_active) {
        this.cache.set(cacheKey, template.template);
        return template.template;
      }

      // No active template found, use default
      console.log(`No active template found for category ${category}, using default`);
      return defaultPrompt;
    } catch (error) {
      console.error(`Error loading prompt template for ${category}:`, error);
      return defaultPrompt;
    }
  }

  /**
   * Clear the cache for a specific category or all categories
   */
  clearCache(category?: PromptCategory): void {
    if (category) {
      this.cache.delete(category);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Save or update a prompt template
   */
  async savePrompt(
    id: string,
    name: string,
    category: PromptCategory,
    template: string
  ): Promise<void> {
    try {
      // Check if template exists
      const existing = await getPromptTemplate(id);

      if (existing) {
        // Update existing
        await updatePromptTemplate(id, template);
      } else {
        // Create new
        await createPromptTemplate(id, name, category, template);
      }

      // Clear cache for this category
      this.clearCache(category);
    } catch (error) {
      console.error('Error saving prompt template:', error);
      throw error;
    }
  }

  /**
   * Get all prompt templates (for management UI)
   */
  async getAllPrompts() {
    return await getAllPromptTemplates();
  }

  /**
   * Build a prompt with variable substitution
   * Variables in template should be in format: {{variableName}}
   */
  buildPrompt(template: string, variables: Record<string, any>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }

    return result;
  }
}

// Export singleton instance
export const promptTemplateService = new PromptTemplateService();
