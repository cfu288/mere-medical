import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { RxDatabase } from 'rxdb';
import { UserDocument } from '../../../models/user-document/UserDocument.type';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';

import { ChatMessage } from './chat-types';
import { PreparedDocuments } from './types';
import { RAGResult, RAGError, RAGOptions } from './types';
import { searchDocuments, iterativeSearch } from './search';
import { prepareDocumentsForContext } from './document-preparation';
import { AIProvider } from '../../../services/ai/types';
import { MEDICAL_AI_SYSTEM_PROMPT, buildRAGUserPrompt } from './prompts';
import { VectorStorage } from '@mere/vector-storage';

export interface RAGContext {
  query: string;
  messages: ChatMessage[];
  user: UserDocument;
  db: RxDatabase<DatabaseCollections>;
  vectorStorage: VectorStorage<DatabaseCollections>;
  aiProvider: AIProvider;
  options?: RAGOptions;
  onStatusUpdate?: (status: string) => void;
}

/**
 * Executes the search and document preparation phases of the RAG pipeline.
 *
 * 1. Searches for relevant documents using vector similarity and/or iterative search
 * 2. Prepares found documents by extracting text, applying reranking, and including related documents
 * 3. Returns prepared documents ready for AI response generation
 *
 * Throws RAGError if no relevant documents are found.
 */
async function performRAGCommon(context: RAGContext): Promise<{
  preparedDocs: PreparedDocuments;
  searchConfidence: number;
}> {
  const {
    query,
    messages,
    user,
    db,
    vectorStorage,
    aiProvider,
    options = {},
    onStatusUpdate,
  } = context;

  onStatusUpdate?.('Searching medical records');
  console.log('[RAG Pipeline] Starting document search for query:', query);
  const searchResult = await searchForDocuments(
    query,
    vectorStorage,
    db,
    user,
    options,
  );
  console.log(
    `[RAG Pipeline] Search complete. Found ${searchResult.documents.length} documents with confidence ${searchResult.confidence.toFixed(2)}`,
  );

  if (searchResult.documents.length === 0) {
    throw new RAGError(
      'No relevant medical records found for your query',
      'NO_DOCUMENTS',
      true,
    );
  }

  onStatusUpdate?.('Preparing information');
  console.log('[RAG Pipeline] Preparing documents for context');
  let preparedDocs;
  try {
    preparedDocs = await prepareDocumentsForContext(
      searchResult.documents,
      searchResult.relevantChunkIds,
      {
        maxDocuments: options.maxDocuments || 20,
        includeRelated: options.includeRelated ?? true,
        query: query,
        db,
        user,
        aiConfig: aiProvider.getConfig ? aiProvider.getConfig() : undefined,
      },
    );
    console.log(
      `[RAG Pipeline] Document preparation complete. Prepared ${preparedDocs.texts.length} text chunks from ${preparedDocs.sourceDocs.length} source documents`,
    );
    console.log(
      `[RAG Pipeline] Source document IDs:`,
      preparedDocs.sourceDocs.map((d) => d.id).slice(0, 5),
      preparedDocs.sourceDocs.length > 5
        ? `... and ${preparedDocs.sourceDocs.length - 5} more`
        : '',
    );
    console.log(
      `[RAG Pipeline] Text chunks preview:`,
      preparedDocs.texts.slice(0, 3).map((t) => ({
        docId: t.sourceDocId,
        preview: t.text.substring(0, 100) + '...',
        score: t.metadata?.relevanceScore,
      })),
    );
  } catch (error) {
    console.error('[RAG Pipeline] Error preparing documents:', error);
    throw error;
  }

  return {
    preparedDocs,
    searchConfidence: searchResult.confidence,
  };
}

/**
 * Executes full RAG pipeline: search → prepare → generate response (non-streaming).
 * For streaming responses, use performRAGWithStreaming instead.
 */
export async function performRAG(context: RAGContext): Promise<RAGResult> {
  const { aiProvider, onStatusUpdate } = context;

  try {
    const { preparedDocs, searchConfidence } = await performRAGCommon(context);

    onStatusUpdate?.('Generating response');
    console.log('[RAG Pipeline] Generating AI response');
    const response = await generateResponse(
      context.query,
      context.messages,
      preparedDocs,
      aiProvider,
    );
    console.log('[RAG Pipeline] AI response generation complete');
    console.log(
      `[RAG Pipeline] Returning ${preparedDocs.sourceDocs.length} source documents to UI:`,
      preparedDocs.sourceDocs
        .map((d) => ({
          id: d.id,
          type: d.data_record?.raw?.resource?.resourceType,
          date: d.metadata?.date,
        }))
        .slice(0, 5),
    );

    return {
      status: 'success',
      response,
      sources: preparedDocs.sourceDocs,
      confidence: searchConfidence,
    };
  } catch (error) {
    if (error instanceof RAGError) {
      return { status: 'error', error };
    }

    return {
      status: 'error',
      error: new RAGError(
        'An unexpected error occurred',
        'AI_PROVIDER',
        false,
        error instanceof Error ? error : new Error(String(error)),
      ),
    };
  }
}

/**
 * Searches medical records using vector similarity.
 * When maxSearchIterations > 1: Performs multiple search rounds to accumulate more results.
 * Otherwise: Single search pass, returns up to limit documents.
 */
async function searchForDocuments(
  query: string,
  vectorStorage: VectorStorage<DatabaseCollections>,
  db: RxDatabase<DatabaseCollections>,
  user: UserDocument,
  options: RAGOptions,
): Promise<{
  documents: ClinicalDocument<BundleEntry<FhirResource>>[];
  relevantChunkIds: string[];
  confidence: number;
}> {
  if (options.maxSearchIterations && options.maxSearchIterations > 1) {
    return await iterativeSearch([query], vectorStorage, db, user, {
      maxIterations: options.maxSearchIterations,
      limit: 30,
    });
  } else {
    return await searchDocuments([query], vectorStorage, db, user, {
      limit: 20,
    });
  }
}

async function generateResponse(
  query: string,
  messages: ChatMessage[],
  documents: PreparedDocuments,
  aiProvider: AIProvider,
): Promise<string> {
  return await aiProvider.complete({
    systemPrompt: MEDICAL_AI_SYSTEM_PROMPT,
    userPrompt: buildRAGUserPrompt(query, documents),
    messages,
    temperature: 0.3,
  });
}

export async function performRAGWithStreaming(
  context: RAGContext & { onChunk: (chunk: string) => void },
): Promise<RAGResult> {
  const { aiProvider, onStatusUpdate, onChunk } = context;

  try {
    const { preparedDocs, searchConfidence } = await performRAGCommon(context);

    onStatusUpdate?.('Generating response');
    console.log('[RAG Pipeline] Starting streaming AI response generation');
    const response = await generateStreamingResponse(
      context.query,
      context.messages,
      preparedDocs,
      aiProvider,
      onChunk,
    );
    console.log('[RAG Pipeline] Streaming AI response complete');
    console.log(
      `[RAG Pipeline] Returning ${preparedDocs.sourceDocs.length} source documents to UI (streaming):`,
      preparedDocs.sourceDocs
        .map((d) => ({
          id: d.id,
          type: d.data_record?.raw?.resource?.resourceType,
          date: d.metadata?.date,
        }))
        .slice(0, 5),
    );

    return {
      status: 'success',
      response,
      sources: preparedDocs.sourceDocs,
      confidence: searchConfidence,
    };
  } catch (error) {
    if (error instanceof RAGError) {
      return { status: 'error', error };
    }

    return {
      status: 'error',
      error: new RAGError(
        'An unexpected error occurred',
        'AI_PROVIDER',
        false,
        error instanceof Error ? error : new Error(String(error)),
      ),
    };
  }
}

async function generateStreamingResponse(
  query: string,
  messages: ChatMessage[],
  documents: PreparedDocuments,
  aiProvider: AIProvider,
  onChunk: (chunk: string) => void,
): Promise<string> {
  return await aiProvider.streamComplete(
    {
      systemPrompt: MEDICAL_AI_SYSTEM_PROMPT,
      userPrompt: buildRAGUserPrompt(query, documents),
      messages,
      temperature: 0.3,
    },
    onChunk,
  );
}
