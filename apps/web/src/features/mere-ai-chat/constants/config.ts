export const SEARCH_CONFIG = {
  MAX_ITERATIONS: 3,
  RESULTS_PER_SEARCH: 8,
  CONFIDENCE_THRESHOLD: 0.8,
  RELEVANCE_SCORE_THRESHOLD: 5, // Lowered from 7 to be less aggressive
  TOP_RESULTS_FALLBACK: 3,
  MAX_PRE_RERANK_DOCUMENTS: 50, // cap documents before reranking
  MAX_FINAL_CONTEXT_DOCUMENTS: 20, // Maximum documents to include in final context
  DISABLE_OLLAMA_RERANKING: false,
  VECTOR_SIMILARITY_THRESHOLD: 0.7, // Minimum similarity score for vector search results
} as const;

export const AI_CONFIG = {
  TEMPERATURE: {
    DETERMINISTIC: 0.1,
    CREATIVE: 0.3,
  },
} as const;

export const CHAT_CONFIG = {
  MAX_CONTEXT_MESSAGES: 10,
  MESSAGE_PREVIEW_LENGTH: 100,
} as const;

export const UI_CONFIG = {
  SCROLL_INTERVAL_MS: 1000,
  SCROLL_DELAY_MS: 100,
} as const;
