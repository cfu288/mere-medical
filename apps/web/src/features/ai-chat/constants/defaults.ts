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

/** The model server the chat will talk to, given the saved experimental settings. */
export function resolveModelServer(config: {
  experimental__ai_provider?: 'openai' | 'ollama';
  experimental__openai_api_key?: string;
  experimental__ollama_endpoint?: string;
  experimental__ollama_model?: string;
}): { endpoint: string; model: string; apiKey?: string } {
  if (config.experimental__ai_provider === 'openai') {
    return {
      endpoint: 'https://api.openai.com/v1',
      model: AI_DEFAULTS.OPENAI.MODEL,
      apiKey: config.experimental__openai_api_key,
    };
  }
  return {
    endpoint:
      config.experimental__ollama_endpoint || AI_DEFAULTS.OLLAMA.ENDPOINT,
    model: config.experimental__ollama_model || AI_DEFAULTS.OLLAMA.MODEL,
  };
}

export const OLLAMA_CHAT_MODELS = [
  {
    value: 'gpt-oss:20b',
    label: 'GPT OSS 20B',
  },
  {
    value: 'qwen3.6:35b-a3b',
    label: 'Qwen 3.6 35B A3B',
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
