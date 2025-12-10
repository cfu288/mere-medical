/**
 * Shared utilities for building messages for AI providers
 */

import { CompletionParams } from './types';
import {
  ChatMessage,
  isUserMessage,
  isAIMessage,
} from '../../features/ai-chat/domain/chat-types';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGE_PAIRS = 5;

function convertChatMessageToAIMessage(msg: ChatMessage): AIMessage | null {
  if (isUserMessage(msg)) {
    return { role: 'user', content: msg.text };
  }
  if (isAIMessage(msg)) {
    return { role: 'assistant', content: msg.text };
  }
  return null;
}

export function buildMessages(params: CompletionParams): AIMessage[] {
  const messages: AIMessage[] = [];

  if (params.systemPrompt) {
    messages.push({
      role: 'system',
      content: params.systemPrompt,
    });
  }

  if (params.messages && params.messages.length > 0) {
    const recentMessages = params.messages.slice(-MAX_MESSAGE_PAIRS * 2);

    for (const msg of recentMessages) {
      const converted = convertChatMessageToAIMessage(msg);
      if (converted) {
        messages.push(converted);
      }
    }
  }

  messages.push({
    role: 'user',
    content: params.userPrompt,
  });

  return messages;
}
