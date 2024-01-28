import React, { useEffect, useState } from 'react';

import { VectorStorage } from '@mere/vector-storage';

import { ClinicalDocumentResourceType } from '../../../../models/clinical-document/ClinicalDocument.type';
import { useLocalConfig } from '../../LocalConfigProvider';
import { useRxDb } from '../../RxDbProvider';
import { DatabaseCollections } from '../../DatabaseCollections';

export const VectorStorageContext = React.createContext<
  VectorStorage<DatabaseCollections> | undefined
>(undefined);

export type DocMeta = {
  category: ClinicalDocumentResourceType;
  document_type: string;
  id: string;
  url?: string;
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

  useEffect(() => {
    if (
      localConfig?.experimental__use_openai_rag &&
      localConfig?.experimental__openai_api_key &&
      localConfig?.experimental__openai_api_key.length >= 50
    ) {
      console.log('Initializing VectorStorage');
      const store = new VectorStorage<DatabaseCollections>({
        openAIApiKey: localConfig?.experimental__openai_api_key,
        rxdb: rxdb,
      });
      if (!store.hasInitialized) {
        store.initialize();
      }
      setVectorStore(store);
    }
  }, [
    localConfig?.experimental__openai_api_key,
    localConfig?.experimental__use_openai_rag,
    rxdb,
  ]);

  return (
    <VectorStorageContext.Provider value={vectorStore}>
      {children}
    </VectorStorageContext.Provider>
  );
}
