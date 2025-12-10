import React, { useEffect, useState, useRef } from 'react';

import { VectorStorage } from '@mere/vector-storage';
import { RxDatabase } from 'rxdb';

import { ClinicalDocumentResourceType } from '../../../models/clinical-document/ClinicalDocument.type';
import { useLocalConfig } from '../../../app/providers/LocalConfigProvider';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { createOllamaEmbeddings } from '../../ai-chat/ollama/ollamaEmbeddings';
import { AI_DEFAULTS } from '../../ai-chat/constants/defaults';

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
  const hasCleanedRef = useRef(false);

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

    const initializeVectorStorage = async () => {
      if (!store) return;

      try {
        // Drop entire collection if migration_pending documents exist
        // This handles the one-time migration from single-user to multi-user
        if (!hasCleanedRef.current) {
          try {
            // Check if any documents have user_id = 'migration_pending'
            // These were created by migration v5 when user_id was unknown
            const allDocs = await rxdb.vector_storage.find().exec();
            const hasMigrationPending = allDocs.some(
              (doc) => doc.user_id === 'migration_pending',
            );

            if (hasMigrationPending) {
              console.log(
                'Found migration_pending documents, dropping entire vector storage for regeneration',
              );
              await rxdb.vector_storage?.remove();
            }

            // Mark migration check as complete
            hasCleanedRef.current = true;
          } catch (checkError: any) {
            // If we get an index error while checking, it likely means we're mid-migration
            // In this case, drop the entire collection to be safe
            if (
              checkError?.message?.includes('index') &&
              checkError?.message?.includes('not found')
            ) {
              console.log(
                'Index error detected during migration check, dropping entire vector storage',
              );
              await rxdb.vector_storage?.remove();
              // Mark migration as handled after dropping collection
              hasCleanedRef.current = true;
            } else {
              console.error(
                'Error checking for migration_pending documents:',
                checkError,
              );
              // Don't mark as complete if we had an unexpected error
            }
          }
        }

        // Initialize the vector storage
        await store.initialize();

        // Only make it available after ALL initialization is complete
        // This prevents VectorGeneratorSyncInitializer from starting before we're ready
        setVectorStore(store);
      } catch (error) {
        console.error('Error initializing vector storage:', error);
        isInitializingRef.current = false;
      }
    };

    if (store && !store.hasInitialized) {
      isInitializingRef.current = true;
      initializeVectorStorage();
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
