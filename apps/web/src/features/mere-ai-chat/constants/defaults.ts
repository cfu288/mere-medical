export const AI_DEFAULTS = {
  OPENAI: {
    MODEL: 'gpt-4o',
    RERANK_MODEL: 'gpt-4o-mini',
    EMBEDDING_MODEL: 'text-embedding-3-large',
  },
  OLLAMA: {
    ENDPOINT: 'http://localhost:11434',
    MODEL: 'gpt-oss:20b',
    EMBEDDING_MODEL: 'mxbai-embed-large',
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

export const OLLAMA_RERANK_MODELS = [
  {
    value: '',
    label: 'None (No Reranking)',
    supportsStructuredOutput: false,
  },
  {
    value: 'qwen2.5:3b',
    label: 'Qwen 2.5 3B',
    supportsStructuredOutput: true,
  },
  {
    value: 'qwen2.5:7b',
    label: 'Qwen 2.5 7B',
    supportsStructuredOutput: true,
  },
] as const;

export const modelSupportsStructuredOutput = (modelName: string): boolean => {
  // Rerank models all support structured output for reranking
  const rerankModel = OLLAMA_RERANK_MODELS.find((m) => m.value === modelName);
  if (rerankModel) return rerankModel.supportsStructuredOutput;
  
  // All chat models support structured output for general queries
  // (reranking will use dedicated rerank models)
  return true;
};

export const OLLAMA_EMBEDDING_MODELS = [
  {
    value: 'dengcao/Qwen3-Embedding-4B:Q4_K_M',
    label: 'Qwen3 Embedding 4B Q4_K_M',
  },
  { value: 'mxbai-embed-large', label: 'mxbai-embed-large' },
  { value: 'nomic-embed-text', label: 'nomic-embed-text' },
] as const;
