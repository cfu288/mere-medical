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

export class VectorStorage<
  T extends {
    vector_storage: RxCollection<{
      id: string; // id: A unique identifier for the document. This is used to identify the document in similarity search results.
      hits?: number; // hits: Optional field that counts the number of times this document has been returned in a similarity search. Omitted if 0.
      metadata: {
        [key: string]: any;
      }; // metadata: An object containing additional information about the document. The structure of this object can vary depending on the application.
      // text: string; // text: The actual text of the document. This is what is used to calculate the document's vector representation.
      timestamp: number; // timestamp: The time when the document was added to the vector storage, represented as a Unix timestamp (milliseconds since the Unix Epoch).
      vectorMag?: number; // vecMag: The magnitude of the document's vector representation. This is precomputed to speed up similarity calculations.
      vector?: number[]; // vec
    }>;
  },
> {
  private rxdb!: RxDatabase<T>;
  private documents: Array<IVSDocument> = [];
  private readonly embeddingModel: string;
  private readonly openaiApiKey?: string;
  private readonly embedTextsFn: (texts: string[]) => Promise<number[][]>;
  public hasInitialized = false;

  constructor(options: IVSOptions<T> = {}) {
    this.embeddingModel =
      options.embeddingModel ?? constants.DEFAULT_OPENAI_EMBEDDING_MODEL;
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
      chunk?: IVSChunkMeta;
    },
    metadata: Record<string, any>,
  ): Promise<IVSDocument> {
    // Create a document from the text and metadata
    const doc: IVSDocument = {
      id: item.id,
      metadata: metadata,
      text: item.text,
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
  ): Promise<Array<IVSDocument>> {
    if (texts.length !== metadatas.length) {
      throw new Error('The lengths of texts and metadata arrays must match.');
    }
    const docs: Array<IVSDocument> = texts.map((item, index) => ({
      id: item.id,
      metadata: metadatas[index],
      text: item.text,
      chunk: item.chunk || undefined,
      timestamp: Date.now(),
      vector: [],
      vectorMag: 0,
    }));
    return await this.addDocuments(docs);
  }

  public async similaritySearch(params: IVSSimilaritySearchParams): Promise<{
    similarItems: Array<IVSSimilaritySearchItem>;
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
    const scoresPairs: Array<[IVSDocument, number]> =
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
      requestIdleCallback(
        async () => {
          try {
            await this.saveToRxDbStorage();
          } catch (e) {
            console.error(e);
          }
        },
        {
          timeout: 1000 * 60,
        },
      );
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
    documents: Array<IVSDocument>,
  ): Promise<Array<IVSDocument>> {
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
      doc.model = this.embeddingModel;
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
    filteredDocuments: Array<IVSDocument>,
    queryVector: number[],
    queryMagnitude: number,
  ): Array<[IVSDocument, number]> {
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

  private updateHitCounters(results: Array<IVSDocument>): void {
    results.forEach((doc) => {
      doc.hits = (doc.hits ?? 0) + 1; // Update hit counter
    });
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

function calcVectorMagnitude(doc: IVSDocument): number {
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
