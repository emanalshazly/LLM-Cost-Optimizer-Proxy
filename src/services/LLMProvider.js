import axios from 'axios';
import { logger } from '../utils/logger.js';

/**
 * Thin client for Anthropic and OpenAI chat APIs.
 *
 * API keys are read lazily on each call (never cached on the instance, never
 * logged), so values loaded by dotenv at process start are always seen and
 * keys don't end up on long-lived objects.
 */
export class LLMProvider {
  constructor() {
    this.providers = {
      anthropic: { baseURL: 'https://api.anthropic.com/v1' },
      openai: { baseURL: 'https://api.openai.com/v1' }
    };
    this.timeoutMs = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS, 10) || 30000;
  }

  async generateResponse(prompt, model) {
    try {
      if (model.startsWith('claude-')) {
        return await this.callAnthropic(prompt, model);
      } else if (model.startsWith('gpt-')) {
        return await this.callOpenAI(prompt, model);
      } else {
        throw new Error(`Unsupported model: ${model}`);
      }
    } catch (error) {
      // Never log request payloads or headers here — only the model name.
      logger.error(`LLM provider error for model ${model}: ${error.message}`);
      throw error;
    }
  }

  async callAnthropic(prompt, model) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const response = await axios.post(
      `${this.providers.anthropic.baseURL}/messages`,
      {
        model: model,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        timeout: this.timeoutMs,
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      }
    );

    return {
      content: response.data.content[0].text,
      usage: {
        input: response.data.usage.input_tokens,
        output: response.data.usage.output_tokens,
        total: response.data.usage.input_tokens + response.data.usage.output_tokens
      }
    };
  }

  async callOpenAI(prompt, model) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await axios.post(
      `${this.providers.openai.baseURL}/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000
      },
      {
        timeout: this.timeoutMs,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      content: response.data.choices[0].message.content,
      usage: {
        input: response.data.usage.prompt_tokens,
        output: response.data.usage.completion_tokens,
        total: response.data.usage.total_tokens
      }
    };
  }
}
