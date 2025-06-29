import { logger } from '../utils/logger.js';

export class PromptOptimizer {
  async optimize(prompt) {
    try {
      let optimized = prompt;

      // Remove excessive whitespace
      optimized = this.removeExcessiveWhitespace(optimized);
      
      // Remove redundant phrases
      optimized = this.removeRedundantPhrases(optimized);
      
      // Simplify language
      optimized = this.simplifyLanguage(optimized);

      logger.info(`Prompt optimization: ${prompt.length} -> ${optimized.length} chars`);
      
      return optimized;
    } catch (error) {
      logger.error('Prompt optimization error:', error);
      return prompt; // Return original if optimization fails
    }
  }

  removeExcessiveWhitespace(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  removeRedundantPhrases(text) {
    const redundantPhrases = [
      /please\s+/gi,
      /kindly\s+/gi,
      /if\s+you\s+could\s+/gi,
      /would\s+you\s+mind\s+/gi,
      /i\s+would\s+like\s+you\s+to\s+/gi,
      /can\s+you\s+please\s+/gi
    ];

    let optimized = text;
    redundantPhrases.forEach(phrase => {
      optimized = optimized.replace(phrase, '');
    });

    return optimized;
  }

  simplifyLanguage(text) {
    const simplifications = {
      'utilize': 'use',
      'demonstrate': 'show',
      'facilitate': 'help',
      'implement': 'do',
      'accomplish': 'do',
      'in order to': 'to',
      'due to the fact that': 'because',
      'at this point in time': 'now'
    };

    let optimized = text;
    Object.entries(simplifications).forEach(([complex, simple]) => {
      const regex = new RegExp(complex, 'gi');
      optimized = optimized.replace(regex, simple);
    });

    return optimized;
  }
}