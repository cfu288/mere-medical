/**
 * Shared utilities for building messages for AI providers
 */

import { CompletionParams } from './types';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Builds messages array from completion parameters
 */
export function buildMessages(params: CompletionParams): AIMessage[] {
  const messages: AIMessage[] = [];

  if (params.systemPrompt) {
    messages.push({
      role: 'system',
      content: params.systemPrompt,
    });
  }

  messages.push({
    role: 'user',
    content: params.userPrompt,
  });

  return messages;
}
