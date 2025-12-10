import { BundleEntry, DiagnosticReport, FhirResource } from 'fhir/r2';
import { prepareClinicalDocumentForVectorization } from '../../vectors/helpers/prepareClinicalDocumentForVectorization';
import { getRelatedDocuments } from '../../timeline/components/cards/DiagnosticReportCard';
import { getRelatedLoincLabs } from '../../timeline/components/ObservationResultRow';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { rerankDocuments } from './rerank-documents';
import { AIProviderConfig, RerankResult } from '../types';
import { SEARCH_CONFIG } from '../constants/config';
import {
  extractRelevantChunks,
  formatChunksForContext,
} from './chunk-extractor';
import {
  DocumentPreparerParams,
  PreparedDataResult,
  ExtractedChunk,
} from '../types';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { UserDocument } from '../../../models/user-document/UserDocument.type';

interface PreparedDoc {
  text: string;
  sourceDoc: ClinicalDocument<BundleEntry<FhirResource>>;
  metadata?: {
    chunkIds?: string[];
    isRelated?: boolean;
    relevanceScore?: number;
  };
}

export type DocumentVectorizer = (
  doc: ClinicalDocument<BundleEntry<FhirResource>>,
) => {
  docList: { id: string; text: string; metadata?: Record<string, unknown> }[];
};

export interface RelatedDocumentsFetcher {
  getRelatedLoincLabs: (params: {
    loinc: string[];
    db: RxDatabase<DatabaseCollections>;
    user: UserDocument;
    limit: number;
  }) => Promise<ClinicalDocument<BundleEntry<FhirResource>>[]>;

  getRelatedDiagnosticReports: (params: {
    db: RxDatabase<DatabaseCollections>;
    user: UserDocument;
    item: ClinicalDocument<BundleEntry<DiagnosticReport>>;
  }) => Promise<[ClinicalDocument<BundleEntry<FhirResource>>[], boolean]>;
}

export interface ChunkExtractor {
  extractRelevantChunks: (
    doc: ClinicalDocument<BundleEntry<FhirResource>>,
    attachmentContent: string | null,
    relevantChunkIds: string[],
  ) => ExtractedChunk[];

  formatChunksForContext: (chunks: ExtractedChunk[]) => string;
}

export type DocumentReranker = (
  documents: string[],
  query: string,
  config: AIProviderConfig,
  relevanceThreshold?: number,
  targetDocuments?: number,
) => Promise<RerankResult>;

export interface DocumentPreparerDependencies {
  vectorizer?: DocumentVectorizer;
  relatedFetcher?: RelatedDocumentsFetcher;
  chunkExtractor?: ChunkExtractor;
  reranker?: DocumentReranker;
}

export class DocumentPreparer {
  private params: DocumentPreparerParams;
  private preparedDocuments: PreparedDoc[] = [];
  private processedIds = new Set<string>();

  private vectorizer: DocumentVectorizer;
  private relatedFetcher: RelatedDocumentsFetcher;
  private chunkExtractor: ChunkExtractor;
  private reranker: DocumentReranker;

  constructor(
    params: DocumentPreparerParams,
    deps?: DocumentPreparerDependencies,
  ) {
    this.params = params;

    // Use injected dependencies or defaults
    this.vectorizer =
      deps?.vectorizer || prepareClinicalDocumentForVectorization;
    this.relatedFetcher = deps?.relatedFetcher || {
      getRelatedLoincLabs,
      getRelatedDiagnosticReports: getRelatedDocuments,
    };
    this.chunkExtractor = deps?.chunkExtractor || {
      extractRelevantChunks,
      formatChunksForContext,
    };
    this.reranker = deps?.reranker || rerankDocuments;
  }

  async extractTexts(): Promise<this> {
    for (const doc of this.params.documents) {
      if (this.processedIds.has(doc.id)) continue;

      const resource = doc.data_record.raw?.resource;
      const isDocumentReference =
        resource?.resourceType === 'DocumentReference';
      const attachmentContent =
        this.params.searchMetadata.attachmentContentMap?.get(doc.id) ||
        (resource as any)?._attachmentContent?.extractedText;

      if (
        isDocumentReference &&
        attachmentContent &&
        this.params.searchMetadata.relevantChunkIds.length > 0
      ) {
        const relevantChunks = this.chunkExtractor.extractRelevantChunks(
          doc,
          attachmentContent,
          this.params.searchMetadata.relevantChunkIds,
        );

        if (relevantChunks.length > 0) {
          const chunkText =
            this.chunkExtractor.formatChunksForContext(relevantChunks);
          const documentHeader = `DocumentReference: ${doc.metadata?.display_name || 'Document'}\n`;

          this.preparedDocuments.push({
            text: documentHeader + chunkText,
            sourceDoc: doc,
            metadata: {
              chunkIds: relevantChunks.map((c) => c.chunkId),
            },
          });
          this.processedIds.add(doc.id);
          continue;
        }
      }

      const chunkedDocs = this.vectorizer(doc).docList;

      if (this.params.searchMetadata.relevantChunkIds.length > 0) {
        const relevantChunks = chunkedDocs.filter((chunk) =>
          this.params.searchMetadata.relevantChunkIds.includes(chunk.id),
        );

        if (relevantChunks.length > 0) {
          this.preparedDocuments.push(
            ...relevantChunks.map((chunk) => ({
              text: chunk.text,
              sourceDoc: doc,
              metadata: {
                chunkIds: [chunk.id],
              },
            })),
          );
          this.processedIds.add(doc.id);
          continue;
        }
      }

      this.preparedDocuments.push(
        ...chunkedDocs.map((chunk) => ({
          text: chunk.text,
          sourceDoc: doc,
        })),
      );
      this.processedIds.add(doc.id);
    }

    return this;
  }

  async fetchRelated(): Promise<this> {
    const relatedDocuments: PreparedDoc[] = [];
    const processedDocs = [...this.preparedDocuments];

    for (const prepDoc of processedDocs) {
      const doc = prepDoc.sourceDoc;
      const resourceType = doc.data_record.raw.resource?.resourceType;
      let relatedDocs: ClinicalDocument<BundleEntry<FhirResource>>[] = [];

      if (resourceType === 'Observation') {
        const loinc = doc.metadata?.loinc_coding || [];
        relatedDocs = await this.relatedFetcher.getRelatedLoincLabs({
          loinc,
          db: this.params.context.db,
          user: this.params.context.user,
          limit: 3,
        });
      } else if (resourceType === 'DiagnosticReport') {
        const [diagnosticReportDocs] =
          await this.relatedFetcher.getRelatedDiagnosticReports({
            db: this.params.context.db,
            user: this.params.context.user,
            item: doc as ClinicalDocument<BundleEntry<DiagnosticReport>>,
          });
        relatedDocs = diagnosticReportDocs;
      }

      for (const relatedDoc of relatedDocs) {
        if (this.processedIds.has(relatedDoc.id)) continue;

        const chunks = this.vectorizer(relatedDoc).docList;
        relatedDocuments.push(
          ...chunks.map((chunk) => ({
            text: chunk.text,
            sourceDoc: relatedDoc,
            metadata: {
              isRelated: true,
            },
          })),
        );

        this.processedIds.add(relatedDoc.id);
      }
    }

    this.preparedDocuments.push(...relatedDocuments);

    return this;
  }

  deduplicate(): this {
    const uniqueMap = new Map<string, PreparedDoc>();

    for (const prepDoc of this.preparedDocuments) {
      const textHash = prepDoc.text.substring(0, 100).toLowerCase().trim();
      const key = `${prepDoc.sourceDoc.id}-${textHash}`;

      const existing = uniqueMap.get(key);
      if (
        !existing ||
        (prepDoc.metadata?.relevanceScore || 0) >
          (existing.metadata?.relevanceScore || 0) ||
        prepDoc.text.length > existing.text.length
      ) {
        uniqueMap.set(key, prepDoc);
      }
    }

    this.preparedDocuments = Array.from(uniqueMap.values());

    return this;
  }

  async rerank(): Promise<this> {
    const query = this.params.context.query;
    const enableReranking = this.params.options?.enableReranking ?? true;

    const shouldSkipReranking =
      !enableReranking ||
      !query ||
      !this.params.aiConfig ||
      this.preparedDocuments.length === 0 ||
      (this.params.aiConfig.aiProvider === 'ollama' &&
        SEARCH_CONFIG.DISABLE_OLLAMA_RERANKING);

    if (shouldSkipReranking) {
      console.log(
        '[RAG Pipeline] Skipping reranking - no documents or reranking disabled',
      );
      return this;
    }

    console.log(
      `[RAG Pipeline] Starting reranking of ${this.preparedDocuments.length} documents with ${this.params.aiConfig?.aiProvider || 'ollama'}`,
    );

    try {
      const config: AIProviderConfig = this.params.aiConfig || {
        aiProvider: 'ollama',
      };

      const texts = this.preparedDocuments.map((d) => d.text);
      const result = await this.reranker(
        texts,
        query,
        config,
        SEARCH_CONFIG.RELEVANCE_SCORE_THRESHOLD,
      );

      if (result.rerankingApplied && result.documents.length > 0) {
        const scoreMap = new Map(
          result.documents.map((d) => [d.text, d.relevanceScore]),
        );

        const previousCount = this.preparedDocuments.length;
        this.preparedDocuments = this.preparedDocuments
          .filter((pd) => scoreMap.has(pd.text))
          .map((pd) => ({
            ...pd,
            metadata: {
              ...pd.metadata,
              relevanceScore: scoreMap.get(pd.text),
            },
          }))
          .sort(
            (a, b) =>
              (b.metadata?.relevanceScore || 0) -
              (a.metadata?.relevanceScore || 0),
          );

        console.log(
          `[RAG Pipeline] Reranking complete. Filtered from ${previousCount} to ${this.preparedDocuments.length} documents`,
        );
        if (this.preparedDocuments.length > 0) {
          console.log(
            `[RAG Pipeline] Top relevance scores: ${this.preparedDocuments
              .slice(0, 3)
              .map((d) => (d.metadata?.relevanceScore || 0).toFixed(2))
              .join(', ')}`,
          );
        }
      } else if (result.documents.length === 0 && texts.length > 0) {
        console.log(
          '[RAG Pipeline] Reranking filtered out all documents, using fallback',
        );
        // If reranking returned no results, keep top N documents as fallback
        this.preparedDocuments = this.preparedDocuments.slice(
          0,
          SEARCH_CONFIG.TOP_RESULTS_FALLBACK,
        );
      }
    } catch (error) {
      console.error(
        '[RAG Pipeline] Reranking failed, continuing without reranking:',
        error,
      );
    }

    return this;
  }

  limit(maxDocuments?: number): this {
    const limit = maxDocuments || SEARCH_CONFIG.MAX_FINAL_CONTEXT_DOCUMENTS;

    if (this.preparedDocuments.length > limit) {
      this.preparedDocuments = this.preparedDocuments.slice(0, limit);
    }

    return this;
  }

  build(): PreparedDataResult {
    const sourceDocMap = new Map<
      string,
      ClinicalDocument<BundleEntry<FhirResource>>
    >();

    for (const prepDoc of this.preparedDocuments) {
      if (!sourceDocMap.has(prepDoc.sourceDoc.id)) {
        sourceDocMap.set(prepDoc.sourceDoc.id, prepDoc.sourceDoc);
      }
    }

    const result: PreparedDataResult = {
      texts: this.preparedDocuments.map((d) => d.text),
      sourceDocs: Array.from(sourceDocMap.values()),
    };

    return result;
  }
}
