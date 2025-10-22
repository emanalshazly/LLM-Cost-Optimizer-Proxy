import request from 'supertest';
import express from 'express';
import proxyRouter from '../../routes/proxy.js';

// Mock dependencies
jest.mock('../../services/AgentChain.js');
jest.mock('../../services/CacheService.js');
jest.mock('../../models/Request.js');
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('Proxy Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/proxy', proxyRouter);
  });

  describe('POST /api/proxy/chat', () => {
    it('should return 400 if prompt is missing', async () => {
      const response = await request(app)
        .post('/api/proxy/chat')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Prompt is required');
    });

    it('should process request successfully', async () => {
      const { AgentChain } = await import('../../services/AgentChain.js');
      const { CacheService } = await import('../../services/CacheService.js');
      const RequestModel = (await import('../../models/Request.js')).default;

      const mockProcessRequest = jest.fn().mockResolvedValue({
        finalResponse: 'Test response',
        modelUsed: 'claude-3-haiku-20240307',
        tokensUsed: { input: 10, output: 20, total: 30 },
        cost: { original: 0.03, optimized: 0.001, saved: 0.029 },
        processingTime: 100,
        cacheHit: false,
        optimizationApplied: true,
        routingReason: 'Simple task'
      });

      AgentChain.mockImplementation(() => ({
        processRequest: mockProcessRequest
      }));

      const mockGet = jest.fn().mockResolvedValue(null);
      const mockSet = jest.fn().mockResolvedValue();

      CacheService.mockImplementation(() => ({
        get: mockGet,
        set: mockSet
      }));

      const mockSave = jest.fn().mockResolvedValue();
      RequestModel.mockImplementation(() => ({
        save: mockSave
      }));

      const response = await request(app)
        .post('/api/proxy/chat')
        .send({
          prompt: 'What is 2+2?',
          model: 'gpt-4',
          provider: 'openai'
        });

      expect(response.status).toBe(200);
      expect(response.body.response).toBe('Test response');
      expect(response.body.model).toBe('claude-3-haiku-20240307');
      expect(response.body.cacheHit).toBe(false);
      expect(mockProcessRequest).toHaveBeenCalledWith('What is 2+2?', 'gpt-4');
      expect(mockSet).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });

    it('should return cached response when available', async () => {
      const { CacheService } = await import('../../services/CacheService.js');
      const RequestModel = (await import('../../models/Request.js')).default;

      const cachedData = {
        response: 'Cached response',
        tokensUsed: { input: 10, output: 20, total: 30 },
        cost: { original: 0.03, optimized: 0.001, saved: 0.029 },
        modelUsed: 'claude-3-haiku-20240307'
      };

      const mockGet = jest.fn().mockResolvedValue(cachedData);
      CacheService.mockImplementation(() => ({
        get: mockGet
      }));

      const mockSave = jest.fn().mockResolvedValue();
      RequestModel.mockImplementation(() => ({
        save: mockSave
      }));

      const response = await request(app)
        .post('/api/proxy/chat')
        .send({
          prompt: 'What is 2+2?',
          model: 'gpt-4'
        });

      expect(response.status).toBe(200);
      expect(response.body.response).toBe('Cached response');
      expect(response.body.cacheHit).toBe(true);
      expect(mockGet).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const { AgentChain } = await import('../../services/AgentChain.js');
      const { CacheService } = await import('../../services/CacheService.js');

      const mockGet = jest.fn().mockResolvedValue(null);
      CacheService.mockImplementation(() => ({
        get: mockGet
      }));

      const mockProcessRequest = jest.fn().mockRejectedValue(new Error('Processing failed'));
      AgentChain.mockImplementation(() => ({
        processRequest: mockProcessRequest
      }));

      const response = await request(app)
        .post('/api/proxy/chat')
        .send({
          prompt: 'test',
          model: 'gpt-4'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('Processing failed');
    });

    it('should use default values for optional parameters', async () => {
      const { AgentChain } = await import('../../services/AgentChain.js');
      const { CacheService } = await import('../../services/CacheService.js');
      const RequestModel = (await import('../../models/Request.js')).default;

      const mockProcessRequest = jest.fn().mockResolvedValue({
        finalResponse: 'Response',
        modelUsed: 'claude-3-haiku-20240307',
        tokensUsed: { input: 10, output: 20, total: 30 },
        cost: { original: 0.03, optimized: 0.001, saved: 0.029 },
        processingTime: 100,
        cacheHit: false,
        optimizationApplied: true,
        routingReason: 'Simple'
      });

      AgentChain.mockImplementation(() => ({
        processRequest: mockProcessRequest
      }));

      const mockGet = jest.fn().mockResolvedValue(null);
      const mockSet = jest.fn().mockResolvedValue();
      CacheService.mockImplementation(() => ({
        get: mockGet,
        set: mockSet
      }));

      const mockSave = jest.fn().mockResolvedValue();
      RequestModel.mockImplementation(() => ({
        save: mockSave
      }));

      const response = await request(app)
        .post('/api/proxy/chat')
        .send({ prompt: 'test' });

      expect(response.status).toBe(200);
      expect(mockProcessRequest).toHaveBeenCalledWith('test', 'gpt-4');
    });
  });
});
