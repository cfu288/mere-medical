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
    // trim at 22000 characters (aprox 8k tokens)
    const docId = x.id!;
    const meta = {
      category: x.data_record.resource_type,
      document_type: 'clinical_document',
      id: docId,
      url: x.metadata?.id!,
    };

    if (x.data_record.content_type === 'application/json') {
      const newUnflatObject: any = x.data_record.raw;
      delete newUnflatObject.link;
      delete newUnflatObject.fullUrl;
      delete newUnflatObject.search;
      delete newUnflatObject.resource.subject;
      delete newUnflatObject.resource.id;
      delete newUnflatObject.resource.status;
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
      // const serialzedKeys = [...new Set(Object.keys(newFlatObject))].join('|');
      // console.log(serialzed);
      // console.log(serialzedKeys);
      docList.push({ id: docId, text: serialzed });
      metaList.push(meta);
    } else if (x.data_record.content_type === 'application/xml') {
      const contentFull = JSON.stringify(x.data_record.raw);
      if (contentFull.length > MAX_CHARS) {
        for (let offset = 0; offset < contentFull.length; offset += MAX_CHARS) {
          const chunk = contentFull.substring(
            offset,
            Math.min(offset + MAX_CHARS, contentFull.length),
          );
          docList.push({ id: docId, text: chunk });
          metaList.push(meta);
        }
      } else {
        docList.push({ id: docId, text: contentFull });
        metaList.push(meta);
      }
    }
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
