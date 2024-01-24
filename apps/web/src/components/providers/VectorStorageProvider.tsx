import React, { useEffect, useRef, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { VectorStorage } from '@mere/vector-storage';

import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../models/clinical-document/ClinicalDocument.type';
import { flattenObject } from '../../utils/flattenObject';
import { DatabaseCollections } from './DatabaseCollections';
import { useLocalConfig } from './LocalConfigProvider';
import { useRxDb } from './RxDbProvider';

export const VectorStorageContext = React.createContext<
  VectorStorage<DocMeta> | undefined
>(undefined);

export type DocMeta = {
  category: ClinicalDocumentResourceType;
  document_type: string;
  id: string;
  url: string;
};

export function VectorStorageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [vectorStore, setVectorStore] = useState<VectorStorage<DocMeta>>();
  const rxdb = useRxDb();
  const localConfig = useLocalConfig();

  useEffect(() => {
    if (
      localConfig?.experimental__use_openai_rag &&
      localConfig?.experimental__openai_api_key &&
      localConfig?.experimental__openai_api_key.length >= 50
    ) {
      console.log('Initializing VectorStorage');
      const store = new VectorStorage<DocMeta>({
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

const PAGE_SIZE = 100;
const MAX_CHARS = 18000;
const CHUNK_SIZE = 1000;

export function prepareClinicalDocumentForVectorization(
  document: ClinicalDocument<unknown>,
) {
  // need to maintain lists since documents can be chunked into multiple documents
  const docList: { id: string; text: string }[] = Array<{
    id: string;
    text: string;
  }>();
  const metaList: DocMeta[] = Array<DocMeta>();

  const docId = document.id!;
  const meta = {
    category: document.data_record.resource_type,
    document_type: 'clinical_document',
    id: docId,
    url: document.metadata?.id!,
  };

  if (document.data_record.content_type === 'application/json') {
    const newUnflatObject: any = document.data_record.raw;
    delete newUnflatObject.link;
    delete newUnflatObject.fullUrl;
    delete newUnflatObject.search;
    delete newUnflatObject.resource.subject;
    delete newUnflatObject.resource.id;
    delete newUnflatObject.resource.status;
    delete newUnflatObject.resource.identifier;
    const newFlatObject = flattenObject(
      Object.keys(newUnflatObject)
        .sort()
        .reduce((obj: any, key: any) => {
          obj[key] = newUnflatObject[key];
          return obj;
        }, {}),
    );
    const serialzed = [...new Set(Object.values(newFlatObject))]
      .join('|')
      .substring(0, MAX_CHARS);
    docList.push({ id: docId, text: serialzed });
    metaList.push(meta);
  } else if (document.data_record.content_type === 'application/xml') {
    const contentFull = document.data_record.raw as string;
    if (contentFull.length > CHUNK_SIZE) {
      for (let offset = 0; offset < contentFull.length; offset += CHUNK_SIZE) {
        const chunk = contentFull.substring(
          offset,
          Math.min(offset + CHUNK_SIZE, contentFull.length),
        );
        docList.push({ id: `${docId}_chunk${offset}`, text: chunk });
        metaList.push(meta);
      }
    } else {
      // docList.push({ id: docId, text: contentFull });
      // metaList.push(meta);
    }
  }

  return { docList, metaList };
}

async function addBatchToVectorStorage(
  documents: RxDocument<ClinicalDocument<unknown>, {}>[],
  vectorStorage: VectorStorage<DocMeta>,
) {
  // allocate to min length
  const docList: { id: string; text: string }[] = Array<{
    id: string;
    text: string;
  }>(documents.length);
  const metaList: DocMeta[] = Array<DocMeta>(documents.length);
  documents.forEach((x) => {
    const { docList: docListChunk, metaList: metaListChunk } =
      prepareClinicalDocumentForVectorization(x);
    docListChunk.forEach((y) => docList.push(y));
    metaListChunk.forEach((y) => metaList.push(y));
  });

  return await vectorStorage.addTexts(docList, metaList);
  // return Promise.resolve([]);
}

/**
 * Class that handles the sync process to OpenAI and synchs all documents in RxDB and stores vectors to VectorStorage
 * @param param0
 * @returns
 */
export class VectorGeneratorSync {
  private db: RxDatabase<DatabaseCollections>;
  private vectorStorage: VectorStorage<any>;
  private page: number;
  private isDone: boolean;
  private totalDocuments: number;
  private currentDocumentsProcessed: number;

  constructor(
    db: RxDatabase<DatabaseCollections>,
    vectorStorage: VectorStorage<any>,
  ) {
    this.db = db;
    this.vectorStorage = vectorStorage;
    this.page = 0;
    this.isDone = false;
    this.totalDocuments = 0;
    this.currentDocumentsProcessed = 0;
  }

  public async syncNextBatch() {
    if (!this.isDone) {
      const documents = await this.db.clinical_documents
        .find()
        .skip(this.page ? this.page * PAGE_SIZE : 0)
        .limit(PAGE_SIZE)
        .exec();
      if (
        documents.length + this.currentDocumentsProcessed >=
        this.totalDocuments
      ) {
        this.isDone = true;
      }

      await addBatchToVectorStorage(documents, this.vectorStorage);
      this.currentDocumentsProcessed =
        this.currentDocumentsProcessed + documents.length;
      this.page = this.page + 1;
    }
    console.debug(
      `VectorSync: ${((this.currentDocumentsProcessed / this.totalDocuments) * 100).toFixed(1)}%; ${this.currentDocumentsProcessed} of ${this.totalDocuments} total documents`,
    );
  }

  public async startSync() {
    this.totalDocuments = await this.db.clinical_documents.count().exec();
    while (!this.isDone) {
      await this.syncNextBatch();
    }
  }
}

export function VectorGenerator({ children }: { children: React.ReactNode }) {
  const vectorStorage = useVectorStorage();
  const rxdb = useRxDb();
  const vsSync = useRef<VectorGeneratorSync>();

  useEffect(() => {
    if (vectorStorage && rxdb && !vsSync.current) {
      vsSync.current = new VectorGeneratorSync(rxdb, vectorStorage);
      vsSync.current.startSync();
    }
  }, [rxdb, vectorStorage]);

  return <>{children}</>;
}

export function useVectorStorage() {
  const context = React.useContext(VectorStorageContext);
  // if (context === undefined) {
  //   throw new Error(
  //     'useVectorStorage must be used within a VectorStorageProvider',
  //   );
  // }
  return context;
}
