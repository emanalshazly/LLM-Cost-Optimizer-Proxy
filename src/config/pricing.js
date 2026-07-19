/**
 * Centralized model pricing table.
 *
 * Prices are USD per 1K tokens, split into input/output. Every cost and
 * savings calculation in the proxy (agent chain, dashboard, request logs)
 * reads from this table, so updating prices or adding models means editing
 * exactly one file.
 *
 * NOTE: these are point-in-time public list prices. Always verify against
 * the provider's current pricing page before quoting savings to customers.
 */
export const MODEL_PRICING = {
  // Anthropic
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },

  // OpenAI
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },

  // Google
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 }
};

// Conservative fallback for unknown models (GPT-4-class pricing).
export const DEFAULT_PRICING = { input: 0.03, output: 0.06 };

export function getModelPricing(model) {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}

/**
 * Cost in USD for a single call with the given token usage.
 * @param {string} model
 * @param {{input?: number, output?: number}} tokensUsed
 */
export function calculateCost(model, tokensUsed = {}) {
  const pricing = getModelPricing(model);
  const inputTokens = tokensUsed.input || 0;
  const outputTokens = tokensUsed.output || 0;
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

/**
 * Compares what the request would have cost on the originally requested
 * model vs. what it cost on the model the chain actually used.
 */
export function calculateSavings(originalModel, usedModel, tokensUsed = {}) {
  const original = calculateCost(originalModel, tokensUsed);
  const optimized = calculateCost(usedModel, tokensUsed);

  return {
    original,
    optimized,
    saved: original - optimized
  };
}
