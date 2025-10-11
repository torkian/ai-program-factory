import fs from 'fs';
import path from 'path';

export interface ProcessedFile {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  extractedText: string;
  wordCount: number;
}

export class FileProcessor {
  /**
   * Extract text from uploaded file
   * For now, we'll handle plain text files. PDF and DOCX would require additional libraries.
   */
  async extractText(filePath: string, mimeType: string): Promise<string> {
    try {
      // For text files, just read directly
      if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return content;
      }

      // For other file types, we'll read as text for now
      // In production, you'd use libraries like pdf-parse or mammoth for PDF/DOCX
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Error extracting text from file:', error);
      return '';
    }
  }

  /**
   * Process uploaded file and extract content
   */
  async processFile(file: Express.Multer.File): Promise<ProcessedFile> {
    const extractedText = await this.extractText(file.path, file.mimetype);
    const wordCount = this.countWords(extractedText);

    return {
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      extractedText,
      wordCount
    };
  }

  /**
   * Process multiple files
   */
  async processFiles(files: Express.Multer.File[]): Promise<ProcessedFile[]> {
    const processed: ProcessedFile[] = [];

    for (const file of files) {
      const result = await this.processFile(file);
      processed.push(result);
    }

    return processed;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Clean up uploaded files
   */
  async cleanupFiles(files: Express.Multer.File[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.promises.unlink(file.path);
      } catch (error) {
        console.error(`Error deleting file ${file.path}:`, error);
      }
    }
  }

  /**
   * Combine multiple documents into single training material
   */
  combineDocuments(processedFiles: ProcessedFile[]): string {
    const combined = processedFiles.map(file => {
      return `\n\n=== ${file.originalName} ===\n\n${file.extractedText}`;
    }).join('\n');

    return combined;
  }

  /**
   * Extract key information from combined documents
   */
  analyzeContent(combinedText: string): {
    totalWords: number;
    estimatedReadingTime: number;
    keyTopics: string[];
  } {
    const words = combinedText.split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;
    const estimatedReadingTime = Math.ceil(totalWords / 200); // 200 words per minute

    // Simple keyword extraction (in production, use NLP)
    const keyTopics: string[] = [];

    return {
      totalWords,
      estimatedReadingTime,
      keyTopics
    };
  }
}

export const fileProcessor = new FileProcessor();
