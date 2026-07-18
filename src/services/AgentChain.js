import { logger } from '../utils/logger.js';
import { LLMProvider } from './LLMProvider.js';
import { PromptOptimizer } from './PromptOptimizer.js';
import { calculateSavings } from '../config/pricing.js';
import { envFlag } from '../utils/env.js';

// Routing table: complexity level -> model that handles it.
export const ROUTING_MODELS = {
  simple: 'claude-3-haiku-20240307',
  medium: 'claude-3-sonnet-20240229',
  complex: 'claude-3-opus-20240229'
};

/**
 * LLMs frequently wrap JSON answers in markdown fences or add prose around
 * them. Extract the first JSON object instead of assuming a clean payload.
 */
function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in LLM response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeUsage(usage = {}) {
  const input = usage.input || 0;
  const output = usage.output || 0;
  return { input, output, total: input + output };
}

function sumUsage(a = {}, b = {}) {
  return normalizeUsage({
    input: (a.input || 0) + (b.input || 0),
    output: (a.output || 0) + (b.output || 0)
  });
}

export class AgentChain {
  constructor(dependencies = {}) {
    this.llmProvider = dependencies.llmProvider || new LLMProvider();
    this.promptOptimizer = dependencies.promptOptimizer || new PromptOptimizer();
  }

  async processRequest(prompt, originalModel = 'gpt-4') {
    const startTime = Date.now();
    const result = {
      finalResponse: null,
      modelUsed: null,
      optimizedPrompt: prompt,
      tokensUsed: { input: 0, output: 0, total: 0 },
      cost: { original: 0, optimized: 0, saved: 0 },
      processingTime: 0,
      optimizationApplied: false,
      routingReason: '',
      cacheHit: false
    };

    try {
      // Step 1: Optional prompt optimization
      if (envFlag('ENABLE_PROMPT_OPTIMIZATION', true)) {
        result.optimizedPrompt = await this.promptOptimizer.optimize(prompt);
        result.optimizationApplied = result.optimizedPrompt !== prompt;
      }
      const optimizedPrompt = result.optimizedPrompt;

      if (!envFlag('ENABLE_SMART_ROUTING', true)) {
        // Smart routing disabled: pass through to the requested model.
        const response = await this.llmProvider.generateResponse(optimizedPrompt, originalModel);
        result.finalResponse = response.content;
        result.modelUsed = originalModel;
        result.routingReason = 'Smart routing disabled — requested model used directly';
        result.tokensUsed = normalizeUsage(response.usage);
      } else {
        // Step 2: Analyze complexity with Haiku (cheapest model)
        const complexityAnalysis = await this.analyzeComplexity(prompt);
        logger.info(`Complexity analysis: ${complexityAnalysis.level}`);
        result.routingReason = complexityAnalysis.reason || '';

        // Step 3: Route to the appropriate model based on complexity
        if (complexityAnalysis.level === 'simple') {
          // Haiku answers simple tasks directly
          const response = await this.llmProvider.generateResponse(optimizedPrompt, ROUTING_MODELS.simple);
          result.finalResponse = response.content;
          result.modelUsed = ROUTING_MODELS.simple;
          result.tokensUsed = normalizeUsage(response.usage);
        } else if (complexityAnalysis.level === 'medium') {
          // Haiku answers first, then Haiku validates its own answer.
          // Only fall back to Sonnet when validation fails.
          const haikuResponse = await this.llmProvider.generateResponse(optimizedPrompt, ROUTING_MODELS.simple);
          const validation = await this.validateResponse(haikuResponse.content, optimizedPrompt);

          if (validation.isGood) {
            result.finalResponse = haikuResponse.content;
            result.modelUsed = ROUTING_MODELS.simple;
            result.tokensUsed = normalizeUsage(haikuResponse.usage);
          } else {
            const sonnetResponse = await this.llmProvider.generateResponse(optimizedPrompt, ROUTING_MODELS.medium);
            result.finalResponse = sonnetResponse.content;
            result.modelUsed = ROUTING_MODELS.medium;
            result.tokensUsed = sumUsage(haikuResponse.usage, sonnetResponse.usage);
          }
        } else {
          // Opus handles truly complex tasks
          const response = await this.llmProvider.generateResponse(optimizedPrompt, ROUTING_MODELS.complex);
          result.finalResponse = response.content;
          result.modelUsed = ROUTING_MODELS.complex;
          result.tokensUsed = normalizeUsage(response.usage);
        }
      }

      // Step 4: Transparent, config-driven cost comparison
      result.cost = this.calculateCostSavings(originalModel, result.modelUsed, result.tokensUsed);
      result.processingTime = Date.now() - startTime;

      return result;
    } catch (error) {
      logger.error('Agent chain processing error:', error.message);
      throw error;
    }
  }

  async analyzeComplexity(prompt) {
    const analysisPrompt = `
Analyze the complexity of this request and classify it as 'simple', 'medium', or 'complex'.

Simple: Basic questions, simple calculations, straightforward information retrieval
Medium: Moderate analysis, creative writing, code review, explanations
Complex: Deep reasoning, complex problem solving, multi-step analysis, research

Request: "${prompt}"

Respond with JSON: {"level": "simple|medium|complex", "reason": "brief explanation", "confidence": 0.0-1.0}
`;

    try {
      const response = await this.llmProvider.generateResponse(analysisPrompt, ROUTING_MODELS.simple);
      return extractJsonObject(response.content);
    } catch (error) {
      logger.warn('Complexity analysis failed, defaulting to medium:', error.message);
      return { level: 'medium', reason: 'Analysis failed', confidence: 0.5 };
    }
  }

  async validateResponse(response, originalPrompt) {
    const validationPrompt = `
Evaluate if this response adequately answers the original question.

Original Question: "${originalPrompt}"
Response: "${response}"

Consider:
- Accuracy and relevance
- Completeness
- Clarity

Respond with JSON: {"isGood": true/false, "reason": "brief explanation", "confidence": 0.0-1.0}
`;

    try {
      const validation = await this.llmProvider.generateResponse(validationPrompt, ROUTING_MODELS.simple);
      return extractJsonObject(validation.content);
    } catch (error) {
      logger.warn('Response validation failed, assuming good:', error.message);
      return { isGood: true, reason: 'Validation failed', confidence: 0.5 };
    }
  }

  selectModel(complexityAnalysis, originalModel) {
    return ROUTING_MODELS[complexityAnalysis?.level] || originalModel;
  }

  calculateCostSavings(originalModel, usedModel, tokensUsed) {
    return calculateSavings(originalModel, usedModel, tokensUsed);
  }
}
