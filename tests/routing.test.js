import { describe, it, expect, afterEach } from '@jest/globals';

process.env.NODE_ENV = 'test';

const { AgentChain, ROUTING_MODELS } = await import('../src/services/AgentChain.js');
const { calculateSavings, calculateCost, getModelPricing, MODEL_PRICING } = await import('../src/config/pricing.js');
const { PromptOptimizer } = await import('../src/services/PromptOptimizer.js');

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const reply = (content, usage = { input: 100, output: 50, total: 150 }) => ({ content, usage });
const analysisReply = (level) => reply(JSON.stringify({ level, reason: `${level} task`, confidence: 0.9 }));
const validationReply = (isGood) => reply(JSON.stringify({ isGood, reason: 'check', confidence: 0.9 }));

/**
 * Scriptable LLM provider fake — answers analysis/validation prompts
 * programmatically and echoes the model name for real prompts.
 */
function fakeProvider({ analysisLevel = 'simple', validationIsGood = true, rawAnalysis = null } = {}) {
  const calls = [];
  return {
    calls,
    async generateResponse(prompt, model) {
      calls.push({ prompt, model });
      if (prompt.includes('Analyze the complexity')) {
        return rawAnalysis !== null ? reply(rawAnalysis) : analysisReply(analysisLevel);
      }
      if (prompt.includes('Evaluate if this response')) {
        return validationReply(validationIsGood);
      }
      return reply(`answer from ${model}`);
    }
  };
}

function makeChain(provider) {
  return new AgentChain({ llmProvider: provider });
}

describe('AgentChain routing', () => {
  it('routes simple prompts to Haiku', async () => {
    const provider = fakeProvider({ analysisLevel: 'simple' });
    const result = await makeChain(provider).processRequest('What is 2+2?', 'gpt-4');

    expect(result.modelUsed).toBe(ROUTING_MODELS.simple);
    expect(result.finalResponse).toBe(`answer from ${ROUTING_MODELS.simple}`);
    // 1 analysis call + 1 answer call
    expect(provider.calls).toHaveLength(2);
    expect(result.tokensUsed.total).toBe(150);
  });

  it('keeps the Haiku answer for medium prompts when validation passes', async () => {
    const provider = fakeProvider({ analysisLevel: 'medium', validationIsGood: true });
    const result = await makeChain(provider).processRequest('Review this function', 'gpt-4');

    expect(result.modelUsed).toBe(ROUTING_MODELS.simple);
    // analysis + haiku answer + validation
    expect(provider.calls).toHaveLength(3);
  });

  it('falls back to Sonnet for medium prompts when validation fails', async () => {
    const provider = fakeProvider({ analysisLevel: 'medium', validationIsGood: false });
    const result = await makeChain(provider).processRequest('Review this function', 'gpt-4');

    expect(result.modelUsed).toBe(ROUTING_MODELS.medium);
    expect(result.finalResponse).toBe(`answer from ${ROUTING_MODELS.medium}`);
    // analysis + haiku answer + validation + sonnet answer
    expect(provider.calls).toHaveLength(4);
    // Token usage accumulates across the haiku attempt and the sonnet fallback
    expect(result.tokensUsed.total).toBe(300);
  });

  it('routes complex prompts to Opus', async () => {
    const provider = fakeProvider({ analysisLevel: 'complex' });
    const result = await makeChain(provider).processRequest('Prove this theorem', 'gpt-4');

    expect(result.modelUsed).toBe(ROUTING_MODELS.complex);
    expect(provider.calls).toHaveLength(2);
  });

  it('bypasses the chain when ENABLE_SMART_ROUTING=false', async () => {
    process.env.ENABLE_SMART_ROUTING = 'false';
    const provider = fakeProvider();
    const result = await makeChain(provider).processRequest('Anything', 'gpt-4');

    expect(result.modelUsed).toBe('gpt-4');
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].model).toBe('gpt-4');
    expect(result.routingReason).toMatch(/disabled/i);
  });

  it('defaults to medium when the analysis response is not valid JSON', async () => {
    const provider = fakeProvider({ rawAnalysis: 'I cannot classify this', validationIsGood: true });
    const result = await makeChain(provider).processRequest('Hello', 'gpt-4');

    // medium path: haiku answer kept after validation
    expect(result.modelUsed).toBe(ROUTING_MODELS.simple);
    expect(provider.calls).toHaveLength(3);
  });

  it('parses analysis JSON wrapped in markdown fences', async () => {
    const provider = fakeProvider({ rawAnalysis: '```json\n{"level": "complex", "reason": "hard"}\n```' });
    const result = await makeChain(provider).processRequest('Deep question', 'gpt-4');

    expect(result.modelUsed).toBe(ROUTING_MODELS.complex);
  });

  it('applies prompt optimization before calling the LLM when enabled', async () => {
    process.env.ENABLE_PROMPT_OPTIMIZATION = 'true';
    const provider = fakeProvider({ analysisLevel: 'simple' });
    const result = await makeChain(provider).processRequest('please   explain    DNS', 'gpt-4');

    expect(result.optimizationApplied).toBe(true);
    // The final answer call received the optimized prompt, not the raw one.
    const answerCall = provider.calls.find(c => !c.prompt.includes('Analyze the complexity'));
    expect(answerCall.prompt).toBe('explain DNS');
  });
});

describe('pricing table', () => {
  it('covers the Anthropic routing models and GPT baselines', () => {
    for (const model of Object.values(ROUTING_MODELS)) {
      expect(MODEL_PRICING[model]).toBeDefined();
    }
    expect(MODEL_PRICING['gpt-4']).toBeDefined();
    expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined();
  });

  it('computes cost from input/output token rates', () => {
    // gpt-4: $0.03/1K input, $0.06/1K output
    const cost = calculateCost('gpt-4', { input: 1000, output: 1000 });
    expect(cost).toBeCloseTo(0.09);
  });

  it('falls back to conservative pricing for unknown models', () => {
    expect(getModelPricing('some-new-model')).toEqual(getModelPricing('gpt-4'));
  });

  it('reports positive savings when gpt-4 traffic is routed to Haiku', async () => {
    const provider = fakeProvider({ analysisLevel: 'simple' });
    const result = await makeChain(provider).processRequest('What is 2+2?', 'gpt-4');

    expect(result.cost.original).toBeGreaterThan(result.cost.optimized);
    expect(result.cost.saved).toBeCloseTo(result.cost.original - result.cost.optimized);

    const direct = calculateSavings('gpt-4', ROUTING_MODELS.simple, { input: 100, output: 50 });
    expect(direct.saved).toBeGreaterThan(0);
  });
});

describe('PromptOptimizer', () => {
  const optimizer = new PromptOptimizer();

  it('collapses whitespace and removes filler phrases', async () => {
    const optimized = await optimizer.optimize('please   kindly    explain\n\n\n DNS');
    expect(optimized).toBe('explain DNS');
  });

  it('simplifies complex words', async () => {
    const optimized = await optimizer.optimize('utilize this to demonstrate caching');
    expect(optimized).toBe('use this to show caching');
  });

  it('returns the original prompt unchanged when nothing matches', async () => {
    const optimized = await optimizer.optimize('explain DNS');
    expect(optimized).toBe('explain DNS');
  });
});
