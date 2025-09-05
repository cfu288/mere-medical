import { AIProvider, CompletionParams } from './types';
import { readStream, parseOllamaChunk } from './stream-utils';
import { buildMessages } from './message-utils';
import { AIProviderConfig } from '../../features/mere-ai-chat/types';
import { modelSupportsStructuredOutput } from '../../features/mere-ai-chat/constants/defaults';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private rerankModel?: string;

  constructor(
    private endpoint: string,
    private defaultModel: string,
    rerankModel?: string,
  ) {
    this.rerankModel = rerankModel;
  }

  getConfig(): AIProviderConfig {
    return {
      aiProvider: 'ollama',
      ollamaEndpoint: this.endpoint,
      ollamaModel: this.defaultModel,
      ollamaRerankModel: this.rerankModel,
      skipReranking: !this.rerankModel || this.rerankModel === '', // Skip reranking if no rerank model is configured
    };
  }

  async complete(params: CompletionParams): Promise<string> {
    const messages = buildMessages(params);

    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || this.defaultModel,
        messages,
        stream: false,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama API error (${response.status}): ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    return data.message.content;
  }

  async completeJSON<T>(params: CompletionParams): Promise<T> {
    const jsonParams = {
      ...params,
      userPrompt: `${params.userPrompt}\n\nIMPORTANT: You must respond with valid JSON only, no additional text or formatting.`,
    };

    const response = await this.complete(jsonParams);

    try {
      return JSON.parse(response) as T;
    } catch {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error('Failed to parse JSON response from Ollama');
    }
  }

  async streamComplete(
    params: CompletionParams,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const messages = buildMessages(params);

    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || this.defaultModel,
        messages,
        stream: true,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama API error: ${response.statusText} - ${errorText}`,
      );
    }

    return readStream(response, {
      onChunk,
      parseChunk: parseOllamaChunk,
    });
  }
}
