import { RxDatabase } from 'rxdb';
import { VectorStorage } from '@mere/vector-storage';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { DatabaseCollections } from '../../components/providers/DatabaseCollections';
import { BundleEntry, FhirResource } from 'fhir/r2';
import type {
  UserMessage,
  AIMessage,
  ChatMessage,
} from '../../domain/chat/types';
export { AI_DEFAULTS } from './constants/defaults';
export type { ChatMessage, UserMessage, AIMessage };

interface RankedDocument {
  text: string;
  relevanceScore: number;
  relevanceReason: string;
}

export interface RerankResult {
  rerankingApplied: boolean;
  documents: RankedDocument[];
}

export interface AIProviderConfig {
  aiProvider: 'openai' | 'ollama';
  openAiKey?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  ollamaRerankModel?: string;  // Optional dedicated reranking model
  skipReranking?: boolean;  // Skip reranking for models that don't support structured output
}

export interface PreparedDataResult {
  texts: string[];
  sourceDocs: ClinicalDocument<BundleEntry<FhirResource>>[];
}

export interface DocumentPreparerParams {
  documents: ClinicalDocument<BundleEntry<FhirResource>>[];
  context: {
    db: RxDatabase<DatabaseCollections>;
    user: UserDocument;
    query?: string;
  };
  searchMetadata: {
    relevantChunkIds: string[];
    attachmentContentMap?: Map<string, string>;
  };
  aiConfig?: AIProviderConfig;
  options?: {
    enableReranking?: boolean;
  };
}

export interface ExtractedChunk {
  documentId: string;
  chunkId: string;
  content: string;
  offset: number;
  size: number;
  sectionType?: string;
}

export interface PerformRAGRequestParams {
  query: string;
  messages: ChatMessage[];
  user: UserDocument;
  db: RxDatabase<DatabaseCollections>;
  vectorStorage: VectorStorage<DatabaseCollections> | null;
  aiProvider: 'openai' | 'ollama';
  openAiKey?: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
  ollamaRerankModel?: string;
  streamingMessageCallback?: (chunk: string) => void;
  onStatusUpdate?: (status: string) => void;
}

export interface PerformRAGRequestResult {
  responseText: string;
  sourceDocs: ClinicalDocument<BundleEntry<FhirResource>>[];
}
