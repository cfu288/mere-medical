import { ICreateEmbeddingResponse } from './types/ICreateEmbeddingResponse';
import { IVSDocument, IVSSimilaritySearchItem } from './types/IVSDocument';
import { IVSOptions } from './types/IVSOptions';
import { IVSSimilaritySearchParams } from './types/IVSSimilaritySearchParams';
import { constants } from './common/constants';
import { filterDocuments } from './common/helpers';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { DatabaseCollections } from 'apps/web/src/components/providers/DatabaseCollections';
import { RxDatabase } from 'rxdb';

export class VectorStorage<
  T extends {
    [key: string]: any;
  },
> {
  private rxdb!: RxDatabase<DatabaseCollections>;
  private documents: Array<IVSDocument<T>> = [];
  private readonly openaiModel: string;
  private readonly openaiApiKey?: string;
  private readonly embedTextsFn: (texts: string[]) => Promise<number[][]>;
  public hasInitialized = false;

  constructor(options: IVSOptions = {}) {
    this.openaiModel = options.openaiModel ?? constants.DEFAULT_OPENAI_MODEL;
    this.embedTextsFn = options.embedTextsFn ?? this.embedTexts; // Use the custom function if provided, else use the default one
    this.openaiApiKey = options.openAIApiKey;
    this.rxdb! = options.rxdb!;
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
    },
    metadata: T,
  ): Promise<IVSDocument<T>> {
    // Create a document from the text and metadata
    const doc: IVSDocument<T> = {
      id: item.id,
      metadata: metadata,
      text: item.text,
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
    }[],
    metadatas: T[],
  ): Promise<Array<IVSDocument<T>>> {
    if (texts.length !== metadatas.length) {
      throw new Error('The lengths of texts and metadata arrays must match.');
    }
    const docs: Array<IVSDocument<T>> = texts.map((item, index) => ({
      id: item.id,
      metadata: metadatas[index],
      text: item.text,
      timestamp: Date.now(),
      vector: [],
      vectorMag: 0,
    }));
    return await this.addDocuments(docs);
  }

  public async similaritySearch(params: IVSSimilaritySearchParams): Promise<{
    similarItems: Array<IVSSimilaritySearchItem<T>>;
    query: { text: string; embedding: number[] };
  }> {
    console.group('similaritySearch');
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
    const scoresPairs: Array<[IVSDocument<T>, number]> =
      this.calculateSimilarityScores(
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
    start = performance.now();
    this.updateHitCounters(results);
    console.debug(
      `Hit counters update took ${(performance.now() - start).toFixed(2)}ms`,
    );
    if (results.length > 0) {
      // Don't let saving to storage block returning the results
      try {
        requestIdleCallback(
          async () => {
            await this.saveToRxDbStorage();
          },
          {
            timeout: 1000 * 60,
          },
        );
      } catch (e) {
        console.error(e);
      }
    }
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

  private async addDocuments(
    documents: Array<IVSDocument<T>>,
  ): Promise<Array<IVSDocument<T>>> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    // filter out already existing documents by id
    const existingDocumentIdSet = new Set(this.documents.map((doc) => doc.id));
    const newDocuments = documents.filter(
      (doc) => !existingDocumentIdSet.has(doc.id),
    );
    // If there are no new documents, return an empty array
    if (newDocuments.length === 0) {
      return [];
    }

    const newVectors = await this.embedTextsFn(
      newDocuments.map((doc) => doc.text!),
    );
    // Assign vectors and precompute vector magnitudes for new documents
    newDocuments.forEach((doc, index) => {
      doc.vector = newVectors[index];
      doc.vectorMag = calcVectorMagnitude(doc);
    });
    // Add new documents to the store
    this.documents.push(...newDocuments);
    // Save to index db storage
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
        model: this.openaiModel,
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
    filteredDocuments: Array<IVSDocument<T>>,
    queryVector: number[],
    queryMagnitude: number,
  ): Array<[IVSDocument<T>, number]> {
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
      score = normalizeScore(score); // Normalize the score
      similarityScores[i] = [doc, score];
    }
    return similarityScores;
  }

  // slower than calculateSimilarityScores
  private calculateSimilarityScoresOld(
    filteredDocuments: Array<IVSDocument<T>>,
    queryVector: number[],
    queryMagnitude: number,
  ): Array<[IVSDocument<T>, number]> {
    return filteredDocuments.map((doc) => {
      const dotProduct = doc.vector!.reduce(
        (sum, val, i) => sum + val * queryVector[i],
        0,
      );
      let score = getCosineSimilarityScore(
        dotProduct,
        doc.vectorMag!,
        queryMagnitude,
      );
      score = normalizeScore(score); // Normalize the score
      return [doc, score];
    });
  }

  private updateHitCounters(results: Array<IVSDocument<T>>): void {
    results.forEach((doc) => {
      doc.hits = (doc.hits ?? 0) + 1; // Update hit counter
    });
  }

  private async loadFromRxDbStorage(): Promise<void> {
    const start = performance.now();
    const rxDocs = await this.rxdb.vector_storage.find().exec();
    this.documents = rxDocs.map((rxDoc) => rxDoc.toJSON() as IVSDocument<T>);
    console.debug(
      `Loading from index db took ${(performance.now() - start).toFixed(2)}ms`,
    );
  }

  private async saveToRxDbStorage(): Promise<void> {
    const totalStart = performance.now();
    try {
      const db = this.rxdb;
      await db.vector_storage.bulkUpsert(
        this.documents.map((doc) => {
          const { text, ...restOfDoc } = doc;
          return restOfDoc;
        }),
      );
    } catch (error: any) {
      console.error('Failed to save to RxDB:', error.message);
    }
    console.debug(
      `Saving to RxDB took ${(performance.now() - totalStart).toFixed(2)}ms`,
    );
  }
}

function requestIdleCallback(fn: () => void, options?: { timeout: number }) {
  if ('requestIdleCallback' in window) {
    // if requestIdleCallback is available, use it
    window.requestIdleCallback(fn, options);
  } else {
    setTimeout(fn, 0);
  }
}

function calcVectorMagnitude(doc: IVSDocument<any>): number {
  return Math.sqrt(doc.vector!.reduce((sum, val) => sum + val * val, 0));
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