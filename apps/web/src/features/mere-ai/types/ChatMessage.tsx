export type ChatMessage = {
  user: 'AI' | 'USER';
  text: string;
  timestamp?: Date;
  id: string;
};
