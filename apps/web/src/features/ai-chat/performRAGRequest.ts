import {
  performRAG,
  performRAGWithStreaming,
  RAGContext,
} from './domain/operations';
import { AI_DEFAULTS } from './constants/defaults';
import { OpenAIProvider } from '../../services/ai/openai-provider';
import { OllamaProvider } from '../../services/ai/ollama-provider';
import { AIProvider } from '../../services/ai/types';

import { PerformRAGRequestParams } from './types';

function createAIProvider(params: PerformRAGRequestParams): AIProvider {
  if (params.aiProvider === 'openai') {
    if (!params.openAiKey) {
      throw new Error('OpenAI API key is required');
    }
    return new OpenAIProvider(params.openAiKey);
  } else {
    return new OllamaProvider(
      params.ollamaEndpoint || AI_DEFAULTS.OLLAMA.ENDPOINT,
      params.ollamaModel || AI_DEFAULTS.OLLAMA.MODEL,
      params.ollamaRerankModel, // Pass the reranking model if provided
    );
  }
}

export async function performRAGRequest(
  params: PerformRAGRequestParams,
): Promise<{ responseText: string; sourceDocs: any[] }> {
  if (!params.vectorStorage) {
    throw new Error('Vector storage is required for RAG operations');
  }

  const aiProvider = createAIProvider(params);

  const context: RAGContext = {
    query: params.query,
    messages: params.messages,
    user: params.user,
    db: params.db,
    vectorStorage: params.vectorStorage,
    aiProvider,
    options: {
      maxDocuments: 20,
      includeRelated: true,
      maxSearchIterations: 3,
      confidenceThreshold: 0.7,
    },
    onStatusUpdate: params.onStatusUpdate,
  };

  const result = params.streamingMessageCallback
    ? await performRAGWithStreaming({
        ...context,
        onChunk: params.streamingMessageCallback,
      })
    : await performRAG(context);

  if (result.status === 'error') {
    throw result.error;
  }

  console.log(`[RAG Pipeline] performRAGRequest returning to UI:`, {
    responseLength: result.response.length,
    sourceDocsCount: result.sources.length,
    sourceDocTypes: result.sources
      .map((d) => d.data_record?.raw?.resource?.resourceType)
      .slice(0, 5),
    confidence: 'confidence' in result ? result.confidence : undefined,
  });

  return {
    responseText: result.response,
    sourceDocs: result.sources,
  };
}
