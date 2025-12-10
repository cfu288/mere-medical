export type UserMessage = {
  type: 'user';
  id: string;
  text: string;
  timestamp: Date;
};

export type AIMessage = {
  type: 'ai';
  id: string;
  text: string;
  timestamp: Date;
  model: string;
  sourceDocIds: string[]; // Document IDs for reference
  confidence: number;
};

export type SystemMessage = {
  type: 'system';
  id: string;
  text: string;
  timestamp: Date;
};

export type ChatMessage = UserMessage | AIMessage | SystemMessage;

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Message with full context for UI display
export interface MessageWithContext<T extends ChatMessage = ChatMessage> {
  message: T;
  sourceDocs?: T extends AIMessage ? any[] : never; // Full documents for display
}

// Type guards
export const isUserMessage = (msg: ChatMessage): msg is UserMessage =>
  msg.type === 'user';
export const isAIMessage = (msg: ChatMessage): msg is AIMessage =>
  msg.type === 'ai';
export const isSystemMessage = (msg: ChatMessage): msg is SystemMessage =>
  msg.type === 'system';
