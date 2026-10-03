import { LogLine, RunSummary } from '../../patient-context/harness/describe';

type UserMessage = {
  type: 'user';
  id: string;
  text: string;
  timestamp: Date;
};

export type RunActivity = RunSummary & { lines: LogLine[] };

type AIMessage = {
  type: 'ai';
  id: string;
  text: string;
  timestamp: Date;
  activity?: RunActivity;
  isError?: boolean;
};

export type ChatMessage = UserMessage | AIMessage;
