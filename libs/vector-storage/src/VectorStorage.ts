import { ICreateEmbeddingResponse } from './types/ICreateEmbeddingResponse';
import {
  IVSChunkMeta,
  IVSDocument,
  IVSSimilaritySearchItem,
} from './types/IVSDocument';
import { IVSOptions } from './types/IVSOptions';
import { IVSSimilaritySearchParams } from './types/IVSSimilaritySearchParams';
import { constants } from './common/constants';
import { filterDocuments } from './common/helpers';
import { RxCollection, RxDatabase } from 'rxdb';

async function digestMessage(message: string) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

export class VectorStorage<
  T extends {
    vector_storage: RxCollection<Omit<IVSDocument, 'text'>>;
  },
> {
  private rxdb!: RxDatabase<T>;
  private documents: IVSDocument[] = [];
  private readonly embeddingModel: string;
  private readonly openaiApiKey?: string;
  private readonly embedTextsFn: (texts: string[]) => Promise<number[][]>;
  public hasInitialized = false;

  constructor(options: IVSOptions<T> = {}) {
    this.embeddingModel =
      options.embeddingModel ?? constants.DEFAULT_OPENAI_EMBEDDING_MODEL;
    this.embedTextsFn = options.embedTextsFn ?? this.embedTexts;
    this.openaiApiKey = options.openAIApiKey;
    this.rxdb = options.rxdb!;
    if (!this.openaiApiKey && !options.embedTextsFn) {
      console.error(
        'VectorStorage: pass as an option either an OpenAI API key or a custom embedTextsFn function.',
      );
    }
  }

  public async initialize() {
    await this.loadFromRxDbStorage();
    this.hasInitialized = true;
  }

  public async addText(
    item: {
      id: string;
      text: string;
      chunk?: IVSChunkMeta;
    },
    metadata: Record<string, any>,
  ): Promise<IVSDocument> {
    const doc: IVSDocument = {
      id: item.id,
      user_id: metadata['user_id'], // Extract user_id to top level
      metadata: metadata,
      text: item.text,
      hash: await digestMessage(item.text),
      chunk: item.chunk || undefined,
      timestamp: Date.now(),
      vector: [],
      vectorMag: 0,
    };
    const docs = await this.addDocuments([doc]);
    return docs[0];
  }

  public async addTexts(
    texts: {
      id: string;
      text: string;
      chunk?: IVSChunkMeta;
    }[],
    metadatas: Record<string, any>[],
  ): Promise<IVSDocument[]> {
    if (texts.length !== metadatas.length) {
      throw new Error('The lengths of texts and metadata arrays must match.');
    }

    const docs: IVSDocument[] = await Promise.all(
      texts.map(async (item, index) => ({
        id: item.id,
        user_id: metadatas[index]['user_id'], // Extract user_id to top level
        metadata: metadatas[index],
        text: item.text,
        hash: await digestMessage(item.text),
        chunk: item.chunk || undefined,
        timestamp: Date.now(),
        vector: [],
        vectorMag: 0,
      })),
    );
    return await this.addDocuments(docs);
  }

  public async similaritySearch(params: IVSSimilaritySearchParams): Promise<{
    similarItems: IVSSimilaritySearchItem[];
    query: { text: string; embedding: number[] };
  }> {
    console.group('VectorStorage: similaritySearch');
    const totalStart = performance.now();
    const { query, k = 4, filterOptions, includeValues } = params;
    console.debug('Starting vector search');
    let start = performance.now();
    const queryEmbedding = await this.embedText(query);
    console.debug(
      `Query embedding took ${(performance.now() - start).toFixed(2)}ms`,
    );
    start = performance.now();
    const queryMagnitude = await this.calculateMagnitude(queryEmbedding);
    console.debug(
      `Magnitude calculation took ${(performance.now() - start).toFixed(2)}ms`,
    );
    start = performance.now();
    const filteredDocuments = filterDocuments(this.documents, filterOptions);
    console.debug(`Filtering took ${(performance.now() - start).toFixed(2)}ms`);
    start = performance.now();
    const scoresPairs: [IVSDocument, number][] = this.calculateSimilarityScores(
      filteredDocuments,
      queryEmbedding,
      queryMagnitude,
    );
    console.debug(
      `Similarity scores calculation took ${(performance.now() - start).toFixed(2)}ms`,
    );
    start = performance.now();
    const sortedPairs = scoresPairs.sort((a, b) => b[1] - a[1]);
    console.debug(`Sorting took ${(performance.now() - start).toFixed(2)}ms`);
    start = performance.now();
    const results = sortedPairs
      .slice(0, k)
      .map((pair) => ({ ...pair[0], score: pair[1] }));
    console.debug(`Slice took ${(performance.now() - start).toFixed(2)}ms`);
    if (!includeValues) {
      results.forEach((result) => {
        delete result.vector;
        delete result.vectorMag;
      });
    }
    console.debug(
      `Total similarity search took ${(performance.now() - totalStart).toFixed(2)}ms`,
    );
    console.groupEnd();
    return {
      query: { embedding: queryEmbedding, text: query },
      similarItems: results,
    };
  }

  private async addDocuments(documents: IVSDocument[]): Promise<IVSDocument[]> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    const existingDocumentIdMap = new Map(
      this.documents.map((doc) => [doc.id, doc]),
    );
    const newDocuments = documents.filter((doc) => {
      if (doc === undefined || doc?.id === undefined) {
        return false;
      }
      const existingDoc = existingDocumentIdMap.get(doc.id);
      const idDoesNotExist = !existingDoc;
      const docExistsButHashIsDifferent =
        existingDoc && doc.hash !== existingDoc.hash;
      const isAIEnhancement =
        existingDoc &&
        doc.metadata?.['hasAISummary'] === true &&
        !existingDoc.metadata?.['hasAISummary'];
      const fileNeedsUpdate =
        idDoesNotExist || docExistsButHashIsDifferent || isAIEnhancement;

      return fileNeedsUpdate;
    });

    if (newDocuments.length === 0) {
      return [];
    }

    const newVectors = await this.embedTextsFn(
      newDocuments.map((doc) => doc.text!),
    );

    if (!newVectors || !Array.isArray(newVectors)) {
      throw new Error('embedTextsFn must return an array of vectors');
    }

    if (newVectors.length !== newDocuments.length) {
      throw new Error('Number of vectors must match number of documents');
    }

    newDocuments.forEach((doc, index) => {
      const vector = newVectors[index];
      if (!vector || !Array.isArray(vector)) {
        throw new Error(`Invalid vector at index ${index}`);
      }
      doc.vector = vector;
      doc.model = this.embeddingModel;
      doc.vectorMag = calcVectorMagnitude(doc);
    });

    newDocuments.forEach((doc) => {
      const { text, ...newDocWithoutText } = doc;
      const existingIndex = this.documents.findIndex((d) => d.id === doc.id);
      if (existingIndex !== -1) {
        this.documents[existingIndex] = newDocWithoutText;
      } else {
        this.documents.push(newDocWithoutText);
      }
    });
    try {
      await this.saveToRxDbStorage();
    } catch (e) {
      console.error(e);
    }
    return newDocuments;
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    const response = await fetch(constants.OPENAI_API_URL, {
      body: JSON.stringify({
        input: texts,
        model: this.embeddingModel,
        dimensions: 512,
      }),
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = (await response.json()) as ICreateEmbeddingResponse;
    return responseData.data.map((data) => data.embedding);
  }

  private async embedText(query: string): Promise<number[]> {
    return (await this.embedTextsFn([query]))[0];
  }

  private calculateMagnitude(embedding: number[]): number {
    const queryMagnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return queryMagnitude;
  }

  private calculateSimilarityScores(
    filteredDocuments: IVSDocument[],
    queryVector: number[],
    queryMagnitude: number,
  ): [IVSDocument, number][] {
    const similarityScores = new Array(filteredDocuments.length);
    for (let i = 0; i < filteredDocuments.length; i++) {
      const doc = filteredDocuments[i];
      let dotProduct = 0;
      for (let idx = 0; idx < doc.vector!.length; idx++) {
        dotProduct += doc.vector![idx] * queryVector[idx];
      }
      let score = getCosineSimilarityScore(
        dotProduct,
        doc.vectorMag!,
        queryMagnitude,
      );
      score = normalizeScore(score);
      similarityScores[i] = [doc, score];
    }
    return similarityScores;
  }

  private async loadFromRxDbStorage(): Promise<void> {
    const start = performance.now();
    const rxDocs = await this.rxdb.vector_storage.find().exec();
    this.documents = rxDocs.map((rxDoc) => rxDoc.toJSON() as IVSDocument);
    console.debug(
      `Loading from index db took ${(performance.now() - start).toFixed(2)}ms`,
    );
  }

  private async saveToRxDbStorage(): Promise<void> {
    const totalStart = performance.now();
    try {
      const db = this.rxdb;
      await db.vector_storage.bulkUpsert(this.documents);
    } catch (error: any) {
      console.error('Failed to save to RxDB:', error.message);
    }
    console.debug(
      `Saving to RxDB took ${(performance.now() - totalStart).toFixed(2)}ms`,
    );
  }
}

function calcVectorMagnitude(doc: IVSDocument): number {
  if (!doc.vector || !Array.isArray(doc.vector) || doc.vector.length === 0) {
    throw new Error('Cannot calculate magnitude of invalid vector');
  }
  return Math.sqrt(doc.vector.reduce((sum, val) => sum + val * val, 0));
}

function getCosineSimilarityScore(
  dotProduct: number,
  magnitudeA: number,
  magnitudeB: number,
): number {
  return dotProduct / (magnitudeA * magnitudeB);
}

function normalizeScore(score: number): number {
  return (score + 1) / 2;
}
