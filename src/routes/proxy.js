import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AgentChain } from '../services/AgentChain.js';
import { CacheService } from '../services/CacheService.js';
import Request from '../models/Request.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const agentChain = new AgentChain();
const cacheService = new CacheService();

router.post('/chat', async (req, res) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const { prompt, model = 'gpt-4', provider = 'openai' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    logger.info(`Processing request ${requestId}: ${prompt.substring(0, 100)}...`);

    // Check cache first
    const cached = await cacheService.get(prompt, model);
    if (cached) {
      const requestLog = new Request({
        requestId,
        originalPrompt: prompt,
        model: cached.modelUsed || model,
        provider,
        response: cached.response,
        tokensUsed: cached.tokensUsed,
        cost: cached.cost || { original: 0, optimized: 0, saved: 0 },
        processingTime: Date.now() - startTime,
        cacheHit: true,
        timestamp: new Date()
      });

      await requestLog.save();

      return res.json({
        requestId,
        response: cached.response,
        model: cached.modelUsed || model,
        tokensUsed: cached.tokensUsed,
        cost: cached.cost,
        processingTime: Date.now() - startTime,
        cacheHit: true
      });
    }

    // Process through agent chain
    const result = await agentChain.processRequest(prompt, model);

    // Cache the result
    await cacheService.set(prompt, result.modelUsed, result.finalResponse, result.tokensUsed);

    // Log the request
    const requestLog = new Request({
      requestId,
      originalPrompt: prompt,
      optimizedPrompt: result.optimizationApplied ? 'optimized' : prompt,
      model: result.modelUsed,
      originalModel: model,
      provider,
      response: result.finalResponse,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      processingTime: result.processingTime,
      cacheHit: result.cacheHit,
      optimizationApplied: result.optimizationApplied,
      routingReason: result.routingReason,
      timestamp: new Date()
    });

    await requestLog.save();

    res.json({
      requestId,
      response: result.finalResponse,
      model: result.modelUsed,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      processingTime: result.processingTime,
      optimizationApplied: result.optimizationApplied,
      routingReason: result.routingReason,
      cacheHit: false
    });

  } catch (error) {
    logger.error(`Request ${requestId} failed:`, error);
    res.status(500).json({ 
      error: 'Internal server error',
      requestId,
      message: error.message 
    });
  }
});

export default router;