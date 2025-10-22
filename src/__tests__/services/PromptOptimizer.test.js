import { PromptOptimizer } from '../../services/PromptOptimizer.js';

describe('PromptOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new PromptOptimizer();
  });

  describe('optimize', () => {
    it('should remove excessive whitespace', async () => {
      const prompt = 'This  is   a   test   with    extra    spaces';
      const result = await optimizer.optimize(prompt);
      expect(result).toBe('This is a test with extra spaces');
    });

    it('should remove redundant phrases', async () => {
      const prompt = 'Please kindly explain this';
      const result = await optimizer.optimize(prompt);
      expect(result).toBe('explain this');
    });

    it('should simplify language', async () => {
      const prompt = 'Please utilize this to demonstrate';
      const result = await optimizer.optimize(prompt);
      expect(result).toBe('use this to show');
    });

    it('should handle complex optimization', async () => {
      const prompt = 'Please   kindly  utilize  this  in order to  demonstrate';
      const result = await optimizer.optimize(prompt);
      expect(result).toBe('use this to show');
    });

    it('should return original prompt if optimization fails', async () => {
      const prompt = 'test';
      const result = await optimizer.optimize(prompt);
      expect(result).toBeTruthy();
    });

    it('should trim leading and trailing whitespace', async () => {
      const prompt = '   test prompt   ';
      const result = await optimizer.optimize(prompt);
      expect(result).toBe('test prompt');
    });
  });

  describe('removeExcessiveWhitespace', () => {
    it('should collapse multiple spaces into one', () => {
      const text = 'hello    world';
      const result = optimizer.removeExcessiveWhitespace(text);
      expect(result).toBe('hello world');
    });

    it('should remove excessive newlines', () => {
      const text = 'line1\n\n\nline2';
      const result = optimizer.removeExcessiveWhitespace(text);
      expect(result).toBe('line1\nline2');
    });
  });

  describe('removeRedundantPhrases', () => {
    it('should remove "please"', () => {
      const text = 'Please help me';
      const result = optimizer.removeRedundantPhrases(text);
      expect(result).toBe('help me');
    });

    it('should remove "kindly"', () => {
      const text = 'Kindly assist';
      const result = optimizer.removeRedundantPhrases(text);
      expect(result).toBe('assist');
    });

    it('should remove "can you please"', () => {
      const text = 'Can you please help';
      const result = optimizer.removeRedundantPhrases(text);
      expect(result).toBe('help');
    });
  });

  describe('simplifyLanguage', () => {
    it('should replace "utilize" with "use"', () => {
      const text = 'utilize this tool';
      const result = optimizer.simplifyLanguage(text);
      expect(result).toBe('use this tool');
    });

    it('should replace "in order to" with "to"', () => {
      const text = 'in order to succeed';
      const result = optimizer.simplifyLanguage(text);
      expect(result).toBe('to succeed');
    });

    it('should handle multiple replacements', () => {
      const text = 'utilize this in order to demonstrate';
      const result = optimizer.simplifyLanguage(text);
      expect(result).toBe('use this to show');
    });
  });
});
