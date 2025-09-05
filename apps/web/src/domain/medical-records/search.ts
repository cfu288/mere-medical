import { VectorStorage } from '@mere/vector-storage';
import { DatabaseCollections } from '../../components/providers/DatabaseCollections';
import { DocumentSearchResult } from './types';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { RxDatabase } from 'rxdb';

interface SearchOptions {
  limit?: number;
  includeAttachments?: boolean;
  chunkIds?: string[];
}

/**
 * Performs a vector search for documents matching the given terms
 */
export async function searchDocuments(
  searchTerms: string[],
  vectorStorage: VectorStorage<DatabaseCollections>,
  db: RxDatabase<DatabaseCollections>,
  user: UserDocument,
  options: SearchOptions = {},
): Promise<DocumentSearchResult> {
  const limit = options.limit || 10;
  const documents: ClinicalDocument<BundleEntry<FhirResource>>[] = [];
  const relevantChunkIds: string[] = [];
  const seenDocIds = new Set<string>();

  const searchQuery =
    searchTerms.length === 1 ? searchTerms[0] : searchTerms.join(' ');

  console.log(
    `[RAG Pipeline] Performing vector search with query: "${searchQuery}" (limit: ${limit})`,
  );

  const searchResults = await vectorStorage.similaritySearch({
    query: searchQuery,
    k: limit,
  });

  console.log(
    `[RAG Pipeline] Vector search returned ${searchResults.similarItems.length} results`,
  );

  for (const result of searchResults.similarItems) {
    // Get document ID from metadata
    const docId =
      result.metadata?.['documentId'] || result.metadata?.['document_id'];

    if (docId && !seenDocIds.has(docId)) {
      const doc = await db.collections['clinical_documents']
        .findOne({
          selector: {
            id: docId,
          },
        })
        .exec();

      if (doc) {
        const docData = doc.toJSON();
        documents.push(docData as ClinicalDocument<BundleEntry<FhirResource>>);
        seenDocIds.add(docId);
      }
    }

    relevantChunkIds.push(result.id);
  }

  const confidence = documents.length > 0 ? 1.0 : 0;

  console.log(
    `[RAG Pipeline] Search complete. Found ${documents.length} unique documents from ${relevantChunkIds.length} chunks`,
  );

  return {
    documents,
    relevantChunkIds,
    searchTerms,
    confidence,
  };
}

/**
 * Performs an iterative search, expanding terms if needed
 */
export async function iterativeSearch(
  initialTerms: string[],
  vectorStorage: VectorStorage<DatabaseCollections>,
  db: RxDatabase<DatabaseCollections>,
  user: UserDocument,
  options: SearchOptions & {
    maxIterations?: number;
    expandTerms?: (terms: string[], iteration: number) => string[];
  } = {},
): Promise<DocumentSearchResult> {
  const maxIterations = options.maxIterations || 3;
  let allDocuments: ClinicalDocument<BundleEntry<FhirResource>>[] = [];
  let allChunkIds: string[] = [];
  let allTerms = [...initialTerms];

  for (let i = 0; i < maxIterations; i++) {
    const iterationTerms = options.expandTerms
      ? options.expandTerms(allTerms, i)
      : allTerms;

    const result = await searchDocuments(
      iterationTerms,
      vectorStorage,
      db,
      user,
      options,
    );

    const newDocs = result.documents.filter(
      (doc) => !allDocuments.some((existing) => existing.id === doc.id),
    );
    allDocuments.push(...newDocs);
    allChunkIds.push(...result.relevantChunkIds);
    allTerms = Array.from(new Set([...allTerms, ...iterationTerms]));

    if (allDocuments.length >= options.limit!) {
      break;
    }
  }

  return {
    documents: allDocuments,
    relevantChunkIds: Array.from(new Set(allChunkIds)),
    searchTerms: allTerms,
    confidence: allDocuments.length > 0 ? 1.0 : 0,
  };
}
