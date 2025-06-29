import { logger } from '../utils/logger.js';
import { LLMProvider } from './LLMProvider.js';
import { PromptOptimizer } from './PromptOptimizer.js';

export class AgentChain {
  constructor() {
    this.llmProvider = new LLMProvider();
    this.promptOptimizer = new PromptOptimizer();
  }

  async processRequest(prompt, originalModel = 'gpt-4') {
    const startTime = Date.now();
    let result = {
      finalResponse: null,
      modelUsed: null,
      tokensUsed: { input: 0, output: 0, total: 0 },
      cost: { original: 0, optimized: 0, saved: 0 },
      processingTime: 0,
      optimizationApplied: false,
      routingReason: '',
      cacheHit: false
    };

    try {
      // Step 1: Analyze complexity with Haiku (cheapest model)
      const complexityAnalysis = await this.analyzeComplexity(prompt);
      logger.info(`Complexity analysis: ${complexityAnalysis.level}`);

      // Step 2: Optimize prompt if needed
      let optimizedPrompt = prompt;
      if (process.env.ENABLE_PROMPT_OPTIMIZATION === 'true') {
        optimizedPrompt = await this.promptOptimizer.optimize(prompt);
        result.optimizationApplied = optimizedPrompt !== prompt;
      }

      // Step 3: Route to appropriate model based on complexity
      const selectedModel = this.selectModel(complexityAnalysis, originalModel);
      result.modelUsed = selectedModel;
      result.routingReason = complexityAnalysis.reason;

      // Step 4: Generate response
      if (complexityAnalysis.level === 'simple') {
        // Use Haiku directly for simple tasks
        const response = await this.llmProvider.generateResponse(
          optimizedPrompt, 
          'claude-3-haiku-20240307'
        );
        result.finalResponse = response.content;
        result.tokensUsed = response.usage;
      } else if (complexityAnalysis.level === 'medium') {
        // Use Haiku first, then validate with Sonnet
        const haikuResponse = await this.llmProvider.generateResponse(
          optimizedPrompt, 
          'claude-3-haiku-20240307'
        );
        
        const validation = await this.validateResponse(haikuResponse.content, optimizedPrompt);
        
        if (validation.isGood) {
          result.finalResponse = haikuResponse.content;
          result.tokensUsed = haikuResponse.usage;
        } else {
          // Fall back to Sonnet
          const sonnetResponse = await this.llmProvider.generateResponse(
            optimizedPrompt, 
            'claude-3-sonnet-20240229'
          );
          result.finalResponse = sonnetResponse.content;
          result.tokensUsed = {
            input: haikuResponse.usage.input + sonnetResponse.usage.input,
            output: haikuResponse.usage.output + sonnetResponse.usage.output,
            total: haikuResponse.usage.total + sonnetResponse.usage.total
          };
        }
      } else {
        // Use Opus for complex tasks
        const response = await this.llmProvider.generateResponse(
          optimizedPrompt, 
          'claude-3-opus-20240229'
        );
        result.finalResponse = response.content;
        result.tokensUsed = response.usage;
      }

      // Calculate costs
      result.cost = this.calculateCostSavings(originalModel, result.modelUsed, result.tokensUsed);
      result.processingTime = Date.now() - startTime;

      return result;
    } catch (error) {
      logger.error('Agent chain processing error:', error);
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
      const response = await this.llmProvider.generateResponse(
        analysisPrompt, 
        'claude-3-haiku-20240307'
      );
      
      const analysis = JSON.parse(response.content);
      return analysis;
    } catch (error) {
      logger.warn('Complexity analysis failed, defaulting to medium:', error);
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
      const validation = await this.llmProvider.generateResponse(
        validationPrompt, 
        'claude-3-haiku-20240307'
      );
      
      const result = JSON.parse(validation.content);
      return result;
    } catch (error) {
      logger.warn('Response validation failed, assuming good:', error);
      return { isGood: true, reason: 'Validation failed', confidence: 0.5 };
    }
  }

  selectModel(complexityAnalysis, originalModel) {
    const { level } = complexityAnalysis;
    
    switch (level) {
      case 'simple':
        return 'claude-3-haiku-20240307';
      case 'medium':
        return 'claude-3-sonnet-20240229';
      case 'complex':
        return 'claude-3-opus-20240229';
      default:
        return originalModel;
    }
  }

  calculateCostSavings(originalModel, usedModel, tokensUsed) {
    // Simplified cost calculation (per 1K tokens)
    const costs = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
    };

    const originalCost = (
      (tokensUsed.input / 1000) * (costs[originalModel]?.input || 0.03) +
      (tokensUsed.output / 1000) * (costs[originalModel]?.output || 0.06)
    );

    const optimizedCost = (
      (tokensUsed.input / 1000) * (costs[usedModel]?.input || 0.03) +
      (tokensUsed.output / 1000) * (costs[usedModel]?.output || 0.06)
    );

    return {
      original: originalCost,
      optimized: optimizedCost,
      saved: originalCost - optimizedCost
    };
  }
}