import axios from 'axios';
import { logger } from '../utils/logger.js';

export class LLMProvider {
  constructor() {
    this.providers = {
      anthropic: {
        baseURL: 'https://api.anthropic.com/v1',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      },
      openai: {
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    };
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
      logger.error(`LLM Provider error for model ${model}:`, error);
      throw error;
    }
  }

  async callAnthropic(prompt, model) {
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
        headers: this.providers.anthropic.headers
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
        headers: this.providers.openai.headers
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