import express from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { AgentChain } from '../services/AgentChain.js';
import { CacheService } from '../services/CacheService.js';
import { requestStore } from '../services/RequestStore.js';
import { logger } from '../utils/logger.js';

const ALLOWED_PROVIDERS = new Set(['openai', 'anthropic']);

/**
 * Factory so tests can inject a mocked AgentChain / CacheService /
 * RequestStore without any module-level mocking.
 */
export function createProxyRouter(dependencies = {}) {
  const router = express.Router();
  const agentChain = dependencies.agentChain || new AgentChain();
  const cacheService = dependencies.cacheService || new CacheService();
  const store = dependencies.requestStore || requestStore;

  router.post('/chat', async (req, res) => {
    const requestId = randomUUID();
    const startTime = Date.now();

    try {
      const { prompt, model = 'gpt-4', provider = 'openai' } = req.body || {};

      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({
          error: 'A non-empty "prompt" string is required',
          requestId
        });
      }

      if (!ALLOWED_PROVIDERS.has(provider)) {
        return res.status(400).json({
          error: `Unsupported provider "${provider}". Allowed: ${[...ALLOWED_PROVIDERS].join(', ')}`,
          requestId
        });
      }

      // Never log raw prompts (PII risk) — only a short, irreversible fingerprint.
      const promptFingerprint = createHash('sha256').update(prompt).digest('hex').slice(0, 12);
      logger.info(`Processing request ${requestId}: prompt#${promptFingerprint} (${prompt.length} chars)`);

      // Check cache first — keyed by the requested model, consistently with set() below.
      const cached = await cacheService.get(prompt, model);
      if (cached) {
        const processingTime = Date.now() - startTime;

        await store.record({
          requestId,
          originalPrompt: prompt,
          model: cached.modelUsed || model,
          originalModel: model,
          provider,
          response: cached.response,
          tokensUsed: cached.tokensUsed,
          cost: cached.cost || { original: 0, optimized: 0, saved: 0 },
          processingTime,
          cacheHit: true,
          timestamp: new Date()
        });

        return res.json({
          requestId,
          response: cached.response,
          model: cached.modelUsed || model,
          tokensUsed: cached.tokensUsed,
          cost: cached.cost,
          processingTime,
          cacheHit: true
        });
      }

      // Process through the agent chain
      const result = await agentChain.processRequest(prompt, model);

      // Cache the result under the same requested-model key used for lookups.
      await cacheService.set(prompt, model, {
        response: result.finalResponse,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        cost: result.cost
      });

      // Log the request (MongoDB when connected, in-memory otherwise).
      await store.record({
        requestId,
        originalPrompt: prompt,
        optimizedPrompt: result.optimizedPrompt,
        model: result.modelUsed,
        originalModel: model,
        provider,
        response: result.finalResponse,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        processingTime: result.processingTime,
        cacheHit: false,
        optimizationApplied: result.optimizationApplied,
        routingReason: result.routingReason,
        timestamp: new Date()
      });

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
      logger.error(`Request ${requestId} failed: ${error.message}`);
      // 502: the failure is upstream (LLM provider), not in this proxy.
      res.status(502).json({
        error: 'Upstream LLM request failed',
        requestId,
        message: error.message
      });
    }
  });

  return router;
}

export default createProxyRouter();
