import { AIProviderConfig } from '../../features/mere-ai-chat/types';

export interface AIProvider {
  name: string;

  /**
   * Completes a prompt with the given configuration
   */
  complete(params: CompletionParams): Promise<string>;

  /**
   * Completes a prompt expecting JSON response
   */
  completeJSON<T = unknown>(params: CompletionParams): Promise<T>;

  /**
   * Streams a completion response
   */
  streamComplete(
    params: CompletionParams,
    onChunk: (chunk: string) => void,
  ): Promise<string>;

  /**
   * Gets the provider configuration for reranking
   */
  getConfig?(): AIProviderConfig;
}

export interface CompletionParams {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIConfig {
  provider: 'openai' | 'ollama';
  apiKey?: string;
  endpoint?: string;
  defaultModel?: string;
  temperature?: number;
}
