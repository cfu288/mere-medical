import React, { useEffect, useState, useRef } from 'react';

import { VectorStorage } from '@mere/vector-storage';

import { ClinicalDocumentResourceType } from '../../../../models/clinical-document/ClinicalDocument.type';
import { useLocalConfig } from '../../LocalConfigProvider';
import { useRxDb } from '../../RxDbProvider';
import { DatabaseCollections } from '../../DatabaseCollections';
import { createOllamaEmbeddings } from '../../../../features/mere-ai-chat/ollama/ollamaEmbeddings';
import { AI_DEFAULTS } from '../../../../features/mere-ai-chat/constants/defaults';

export const VectorStorageContext = React.createContext<
  VectorStorage<DatabaseCollections> | undefined
>(undefined);

export type DocMeta = {
  category: ClinicalDocumentResourceType;
  document_type: string;
  id: string;
  url?: string;
  documentId?: string;
  sectionName?: string;
  chunkNumber?: number;
  isFullDocument?: boolean;
  user_id?: string;
  [key: string]: any;
};

/**
 * Initializes a VectorStorage instance and provides it to the children
 * Enables search for documents via vector search
 * @param param0
 * @returns
 */
export function VectorStorageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [vectorStore, setVectorStore] =
    useState<VectorStorage<DatabaseCollections>>();
  const rxdb = useRxDb();
  const localConfig = useLocalConfig();
  const isInitializingRef = useRef(false);

  useEffect(() => {
    if (!localConfig?.experimental__use_openai_rag || !rxdb) {
      return;
    }

    // Prevent multiple initializations
    if (isInitializingRef.current) {
      return;
    }

    const aiProvider = localConfig.experimental__ai_provider || 'ollama';
    let store: VectorStorage<DatabaseCollections> | null = null;

    if (
      aiProvider === 'openai' &&
      localConfig.experimental__openai_api_key &&
      localConfig.experimental__openai_api_key.length >= 50
    ) {
      store = new VectorStorage<DatabaseCollections>({
        openAIApiKey: localConfig.experimental__openai_api_key,
        rxdb: rxdb,
      });
    } else if (aiProvider === 'ollama') {
      const ollamaEndpoint =
        localConfig.experimental__ollama_endpoint ||
        AI_DEFAULTS.OLLAMA.ENDPOINT;
      const ollamaEmbeddingModel =
        localConfig.experimental__ollama_embedding_model ||
        AI_DEFAULTS.OLLAMA.EMBEDDING_MODEL;

      store = new VectorStorage<DatabaseCollections>({
        rxdb: rxdb,
        embeddingModel: ollamaEmbeddingModel,
        embedTextsFn: async (texts: string[]) => {
          return createOllamaEmbeddings(
            texts,
            ollamaEndpoint,
            ollamaEmbeddingModel,
          );
        },
      });
    }

    if (store && !store.hasInitialized) {
      isInitializingRef.current = true;
      store.initialize();
      setVectorStore(store);
      // Note: If initialize() is async and we need to wait for it,
      // we would need to handle that with a promise
    }
  }, [
    localConfig?.experimental__openai_api_key,
    localConfig?.experimental__use_openai_rag,
    localConfig?.experimental__ai_provider,
    localConfig?.experimental__ollama_endpoint,
    localConfig?.experimental__ollama_embedding_model,
    rxdb,
  ]);

  return (
    <VectorStorageContext.Provider value={vectorStore}>
      {children}
    </VectorStorageContext.Provider>
  );
}
