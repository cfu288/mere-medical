import { RxDatabase, RxDocument } from 'rxdb';
import { VectorStorage } from '@mere/vector-storage';
import { DatabaseCollections } from '../../DatabaseCollections';
import { DocMeta } from './VectorStorageProvider';
import { PAGE_SIZE } from '../constants';
import { prepareClinicalDocumentForVectorization } from '../helpers/prepareClinicalDocumentForVectorization';
import { ClinicalDocument } from '../../../../models/clinical-document/ClinicalDocument.type';

/**
 * Class that handles the process of sending local documents to OpenAI for vectorization.
 * @param param0
 * @returns
 */
export class VectorGeneratorSyncer {
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

  /**
   * Iterates through all of the clinical documents in the database and sends
   * them to OpenAI for vectorization
   */
  public async startSync() {
    this.totalDocuments = await this.db.clinical_documents.count().exec();
    while (!this.isDone) {
      await this.syncNextBatch();
    }
  }
}

/**
 * Adds a batch of documents to the vector storage
 * @param documents
 * @param vectorStorage
 * @returns
 */
export async function addBatchToVectorStorage(
  documents: RxDocument<ClinicalDocument<unknown>, {}>[],
  vectorStorage: VectorStorage<DatabaseCollections>,
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
}
