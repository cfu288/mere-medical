import { AIProvider, CompletionParams } from './types';
import { readStream, parseOpenAIChunk } from './stream-utils';
import { buildMessages } from './message-utils';
import { AI_DEFAULTS } from '../../features/ai-chat/constants/defaults';
import { AIProviderConfig } from '../../features/ai-chat/types';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';

  constructor(
    private apiKey: string,
    private defaultModel = AI_DEFAULTS.OPENAI.MODEL,
  ) {}

  getConfig(): AIProviderConfig {
    return {
      aiProvider: 'openai',
      openAiKey: this.apiKey,
    };
  }

  async complete(params: CompletionParams): Promise<string> {
    const response = await this.callAPI(params, false);
    return response.choices[0].message.content;
  }

  async completeJSON<T>(params: CompletionParams): Promise<T> {
    const response = await this.callAPI(params, true);
    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async streamComplete(
    params: CompletionParams,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const messages = buildMessages(params);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || this.defaultModel,
        messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    return readStream(response, {
      onChunk,
      parseChunk: parseOpenAIChunk,
    });
  }

  private async callAPI(params: CompletionParams, expectJson: boolean) {
    const messages = buildMessages(params);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || this.defaultModel,
        messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens,
        ...(expectJson && { response_format: { type: 'json_object' } }),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    return await response.json();
  }
}
