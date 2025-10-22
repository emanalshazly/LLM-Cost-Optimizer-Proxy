import { AgentChain } from '../../services/AgentChain.js';

// Mock dependencies
jest.mock('../../services/LLMProvider.js');
jest.mock('../../services/PromptOptimizer.js');
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('AgentChain', () => {
  let agentChain;
  let mockLLMProvider;
  let mockPromptOptimizer;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ENABLE_PROMPT_OPTIMIZATION = 'true';

    agentChain = new AgentChain();
    mockLLMProvider = agentChain.llmProvider;
    mockPromptOptimizer = agentChain.promptOptimizer;
  });

  describe('analyzeComplexity', () => {
    it('should analyze prompt complexity', async () => {
      const mockResponse = {
        content: JSON.stringify({
          level: 'simple',
          reason: 'Basic question',
          confidence: 0.9
        }),
        usage: { input: 10, output: 5, total: 15 }
      };
      mockLLMProvider.generateResponse = jest.fn().mockResolvedValue(mockResponse);

      const result = await agentChain.analyzeComplexity('What is 2+2?');

      expect(result.level).toBe('simple');
      expect(result.reason).toBe('Basic question');
      expect(mockLLMProvider.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('What is 2+2?'),
        'claude-3-haiku-20240307'
      );
    });

    it('should default to medium on error', async () => {
      mockLLMProvider.generateResponse = jest.fn().mockRejectedValue(new Error('API error'));

      const result = await agentChain.analyzeComplexity('test');

      expect(result.level).toBe('medium');
      expect(result.reason).toBe('Analysis failed');
    });
  });

  describe('validateResponse', () => {
    it('should validate response quality', async () => {
      const mockResponse = {
        content: JSON.stringify({
          isGood: true,
          reason: 'Complete answer',
          confidence: 0.95
        }),
        usage: { input: 10, output: 5, total: 15 }
      };
      mockLLMProvider.generateResponse = jest.fn().mockResolvedValue(mockResponse);

      const result = await agentChain.validateResponse('Paris', 'What is the capital of France?');

      expect(result.isGood).toBe(true);
      expect(result.reason).toBe('Complete answer');
    });

    it('should assume good on validation error', async () => {
      mockLLMProvider.generateResponse = jest.fn().mockRejectedValue(new Error('API error'));

      const result = await agentChain.validateResponse('response', 'prompt');

      expect(result.isGood).toBe(true);
      expect(result.reason).toBe('Validation failed');
    });
  });

  describe('selectModel', () => {
    it('should select Haiku for simple tasks', () => {
      const analysis = { level: 'simple', reason: 'Basic', confidence: 0.9 };
      const model = agentChain.selectModel(analysis, 'gpt-4');
      expect(model).toBe('claude-3-haiku-20240307');
    });

    it('should select Sonnet for medium tasks', () => {
      const analysis = { level: 'medium', reason: 'Moderate', confidence: 0.8 };
      const model = agentChain.selectModel(analysis, 'gpt-4');
      expect(model).toBe('claude-3-sonnet-20240229');
    });

    it('should select Opus for complex tasks', () => {
      const analysis = { level: 'complex', reason: 'Advanced', confidence: 0.7 };
      const model = agentChain.selectModel(analysis, 'gpt-4');
      expect(model).toBe('claude-3-opus-20240229');
    });

    it('should fallback to original model for unknown level', () => {
      const analysis = { level: 'unknown', reason: 'Unknown', confidence: 0.5 };
      const model = agentChain.selectModel(analysis, 'gpt-4');
      expect(model).toBe('gpt-4');
    });
  });

  describe('calculateCostSavings', () => {
    it('should calculate cost savings correctly', () => {
      const tokensUsed = { input: 1000, output: 1000, total: 2000 };

      const result = agentChain.calculateCostSavings(
        'gpt-4',
        'claude-3-haiku-20240307',
        tokensUsed
      );

      expect(result.original).toBeGreaterThan(result.optimized);
      expect(result.saved).toBeGreaterThan(0);
      expect(result.saved).toBe(result.original - result.optimized);
    });

    it('should handle zero savings when same model', () => {
      const tokensUsed = { input: 1000, output: 1000, total: 2000 };

      const result = agentChain.calculateCostSavings(
        'claude-3-haiku-20240307',
        'claude-3-haiku-20240307',
        tokensUsed
      );

      expect(result.original).toBe(result.optimized);
      expect(result.saved).toBe(0);
    });
  });

  describe('processRequest', () => {
    it('should process simple request with Haiku', async () => {
      mockPromptOptimizer.optimize = jest.fn().mockResolvedValue('optimized prompt');

      const complexityResponse = {
        content: JSON.stringify({ level: 'simple', reason: 'Basic', confidence: 0.9 }),
        usage: { input: 10, output: 5, total: 15 }
      };

      const finalResponse = {
        content: 'The answer is 4',
        usage: { input: 20, output: 10, total: 30 }
      };

      mockLLMProvider.generateResponse = jest.fn()
        .mockResolvedValueOnce(complexityResponse)
        .mockResolvedValueOnce(finalResponse);

      const result = await agentChain.processRequest('What is 2+2?', 'gpt-4');

      expect(result.finalResponse).toBe('The answer is 4');
      expect(result.modelUsed).toBe('claude-3-haiku-20240307');
      expect(result.cost.saved).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should process medium request with validation', async () => {
      mockPromptOptimizer.optimize = jest.fn().mockResolvedValue('optimized prompt');

      const complexityResponse = {
        content: JSON.stringify({ level: 'medium', reason: 'Moderate', confidence: 0.8 }),
        usage: { input: 10, output: 5, total: 15 }
      };

      const haikuResponse = {
        content: 'Initial answer',
        usage: { input: 20, output: 10, total: 30 }
      };

      const validationResponse = {
        content: JSON.stringify({ isGood: true, reason: 'Good', confidence: 0.9 }),
        usage: { input: 5, output: 3, total: 8 }
      };

      mockLLMProvider.generateResponse = jest.fn()
        .mockResolvedValueOnce(complexityResponse)
        .mockResolvedValueOnce(haikuResponse)
        .mockResolvedValueOnce(validationResponse);

      const result = await agentChain.processRequest('Moderate question', 'gpt-4');

      expect(result.finalResponse).toBe('Initial answer');
      expect(result.modelUsed).toBe('claude-3-sonnet-20240229');
    });

    it('should handle errors gracefully', async () => {
      mockLLMProvider.generateResponse = jest.fn().mockRejectedValue(new Error('API error'));

      await expect(agentChain.processRequest('test', 'gpt-4')).rejects.toThrow('API error');
    });

    it('should skip optimization when disabled', async () => {
      process.env.ENABLE_PROMPT_OPTIMIZATION = 'false';
      agentChain = new AgentChain();
      mockLLMProvider = agentChain.llmProvider;
      mockPromptOptimizer = agentChain.promptOptimizer;

      const complexityResponse = {
        content: JSON.stringify({ level: 'simple', reason: 'Basic', confidence: 0.9 }),
        usage: { input: 10, output: 5, total: 15 }
      };

      const finalResponse = {
        content: 'Answer',
        usage: { input: 20, output: 10, total: 30 }
      };

      mockLLMProvider.generateResponse = jest.fn()
        .mockResolvedValueOnce(complexityResponse)
        .mockResolvedValueOnce(finalResponse);

      const result = await agentChain.processRequest('test', 'gpt-4');

      expect(mockPromptOptimizer.optimize).not.toHaveBeenCalled();
      expect(result.optimizationApplied).toBe(false);
    });
  });
});
