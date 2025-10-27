import { Router } from 'express';
import { promptTemplateService } from '../services/promptTemplateService';
import {
  getAllPromptTemplates,
  getPromptTemplate,
  createPromptTemplate,
  updatePromptTemplate
} from '../database/queries';

const router = Router();

/**
 * Get all prompt templates
 */
router.get('/', async (req, res) => {
  try {
    const templates = await getAllPromptTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching prompt templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a single prompt template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await getPromptTemplate(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error: any) {
    console.error('Error fetching prompt template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create a new prompt template
 */
router.post('/', async (req, res) => {
  try {
    const { id, name, category, template } = req.body;

    if (!id || !name || !category || !template) {
      return res.status(400).json({
        error: 'Missing required fields: id, name, category, template'
      });
    }

    await createPromptTemplate(id, name, category, template);

    // Clear cache for this category
    promptTemplateService.clearCache(category);

    res.json({
      success: true,
      message: 'Prompt template created successfully'
    });
  } catch (error: any) {
    console.error('Error creating prompt template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update an existing prompt template
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { template, category } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template content is required' });
    }

    // Check if template exists
    const existing = await getPromptTemplate(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await updatePromptTemplate(id, template);

    // Clear cache for this category
    if (category) {
      promptTemplateService.clearCache(category);
    } else {
      // If category not provided, clear all cache to be safe
      promptTemplateService.clearCache();
    }

    res.json({
      success: true,
      message: 'Prompt template updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating prompt template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear prompt cache (useful after bulk updates)
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const { category } = req.body;

    if (category) {
      promptTemplateService.clearCache(category);
      res.json({
        success: true,
        message: `Cache cleared for category: ${category}`
      });
    } else {
      promptTemplateService.clearCache();
      res.json({
        success: true,
        message: 'All cache cleared'
      });
    }
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset a single prompt to default
 */
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the current template to know its category
    const existing = await getPromptTemplate(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Import seed to get defaults
    const { getDatabase } = require('../database/init');
    const { seedPromptTemplates } = require('../database/seed');

    const db = await getDatabase();

    // Delete this specific template
    await db.run('DELETE FROM prompt_templates WHERE id = ?', [id]);

    // Reseed (will only add missing templates)
    await seedPromptTemplates();

    // Get the newly seeded template
    const newTemplate = await getPromptTemplate(id);

    // Clear cache for this category
    promptTemplateService.clearCache(existing.category as any);

    res.json({
      success: true,
      message: 'Prompt reset to default',
      template: newTemplate
    });
  } catch (error: any) {
    console.error('Error resetting prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset a single prompt to its default value
 */
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the default templates
    const { getDefaultTemplates } = require('../database/seed');
    const defaults = getDefaultTemplates();

    // Find the default for this ID
    const defaultTemplate = defaults.find((t: any) => t.id === id);

    if (!defaultTemplate) {
      return res.status(404).json({
        error: 'Default template not found for this ID'
      });
    }

    // Update the template with default value
    await updatePromptTemplate(id, defaultTemplate.template);

    // Clear cache for this category
    promptTemplateService.clearCache(defaultTemplate.category);

    res.json({
      success: true,
      message: 'Prompt reset to default successfully',
      template: defaultTemplate.template
    });
  } catch (error: any) {
    console.error('Error resetting prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset all prompts to defaults (dangerous - requires confirmation)
 */
router.post('/reset', async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'RESET_ALL_PROMPTS') {
      return res.status(400).json({
        error: 'Confirmation required. Send { confirm: "RESET_ALL_PROMPTS" }'
      });
    }

    // Import getDatabase to delete and reseed
    const { getDatabase } = require('../database/init');
    const { seedPromptTemplates } = require('../database/seed');

    const db = await getDatabase();

    // Delete all existing templates
    await db.run('DELETE FROM prompt_templates');

    // Reseed with defaults
    await seedPromptTemplates();

    // Clear all caches
    promptTemplateService.clearCache();

    res.json({
      success: true,
      message: 'All prompts reset to defaults successfully'
    });
  } catch (error: any) {
    console.error('Error resetting prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router };
