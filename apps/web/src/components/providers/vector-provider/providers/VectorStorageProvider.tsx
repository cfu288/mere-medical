import React, { useEffect, useState, useRef } from 'react';

import { VectorStorage } from '@mere/vector-storage';
import { RxDatabase } from 'rxdb';

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
 * Resolves vector storage documents that were marked as 'migration_pending'
 * during migration from single-user to multi-user schema.
 * These documents need to be assigned to the existing user.
 */
async function resolveMigrationPendingDocuments(
  rxdb: RxDatabase<DatabaseCollections>
): Promise<void> {
  try {
    // First check if there are any migration_pending documents
    const pendingDocs = await rxdb.vector_storage
      .find({ selector: { user_id: 'migration_pending' } })
      .exec();

    if (pendingDocs.length === 0) {
      return; // Nothing to resolve
    }

    // Get the selected user (or any user for single-user apps transitioning to multi-user)
    let user = await rxdb.user_documents
      .findOne({ selector: { is_selected_user: true } })
      .exec();

    if (!user) {
      // If no selected user, try to get any user (for single-user apps)
      user = await rxdb.user_documents.findOne().exec();
      if (!user) {
        console.warn('No user found to resolve migration_pending vector documents');
        return;
      }
    }

    console.log(`Resolving ${pendingDocs.length} migration_pending vector documents to user ${user.id}`);

    // Update all documents to the correct user_id
    // Using bulk update for better performance
    const updatePromises = pendingDocs.map(doc =>
      doc.update({ $set: { user_id: user.id } })
    );

    await Promise.all(updatePromises);

    console.log('Successfully resolved migration_pending vector documents');
  } catch (error) {
    console.error('Error resolving migration_pending documents:', error);
    // Don't throw - this shouldn't break the app initialization
  }
}

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
  const hasResolvedMigrationRef = useRef(false);

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

      // Resolve any migration_pending documents after initialization
      // This handles the transition from single-user to multi-user
      if (!hasResolvedMigrationRef.current) {
        hasResolvedMigrationRef.current = true;
        resolveMigrationPendingDocuments(rxdb).catch(error => {
          console.error('Failed to resolve migration pending documents:', error);
        });
      }
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
