import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

process.env.NODE_ENV = 'test';

jest.unstable_mockModule('axios', () => ({
  default: { post: jest.fn() }
}));

const axios = (await import('axios')).default;
const { LLMProvider } = await import('../src/services/LLMProvider.js');

const ORIGINAL_ENV = { ...process.env };

describe('LLMProvider — Google Gemini', () => {
  beforeEach(() => {
    axios.post.mockReset();
    process.env.GOOGLE_API_KEY = 'test-google-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('routes gemini-* models to the Google Generative Language API', async () => {
    axios.post.mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [{ text: 'hello from gemini' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 }
      }
    });

    const provider = new LLMProvider();
    const result = await provider.generateResponse('hi', 'gemini-1.5-flash');

    expect(result.content).toBe('hello from gemini');
    expect(result.usage).toEqual({ input: 5, output: 3, total: 8 });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/models/gemini-1.5-flash:generateContent'),
      expect.objectContaining({ contents: [{ parts: [{ text: 'hi' }] }] }),
      expect.objectContaining({ params: { key: 'test-google-key' } })
    );
  });

  it('throws when GOOGLE_API_KEY is not configured', async () => {
    delete process.env.GOOGLE_API_KEY;
    const provider = new LLMProvider();

    await expect(provider.generateResponse('hi', 'gemini-1.5-flash')).rejects.toThrow('GOOGLE_API_KEY is not configured');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('throws for an unsupported model prefix', async () => {
    const provider = new LLMProvider();
    await expect(provider.generateResponse('hi', 'llama-3-70b')).rejects.toThrow('Unsupported model');
    expect(axios.post).not.toHaveBeenCalled();
  });
});
