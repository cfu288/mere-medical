export const AI_DEFAULTS = {
  OPENAI: {
    MODEL: 'gpt-4o',
  },
  OLLAMA: {
    ENDPOINT: 'http://localhost:11434',
    MODEL: 'gpt-oss:20b',
  },
} as const;

export const DEFAULT_AI_PROVIDER = 'ollama' as const;

export const OLLAMA_CHAT_MODELS = [
  {
    value: 'gpt-oss:20b',
    label: 'GPT OSS 20B',
  },
  {
    value: 'deepseek-r1:14b',
    label: 'DeepSeek R1 14B',
  },
  {
    value: 'qwen2.5:14b-instruct',
    label: 'Qwen 2.5 14B Instruct',
  },
  {
    value: 'qwen2.5:32b-instruct',
    label: 'Qwen 2.5 32B Instruct',
  },
] as const;
