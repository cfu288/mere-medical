import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource, DiagnosticReport } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../components/providers/DatabaseCollections';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { DocumentText, PreparedDocuments } from '../medical-records/types';
import { extractTextsFromDocuments } from '../medical-records/extraction';
import { getRelatedDocuments } from '../../components/timeline/DiagnosticReportCard';
import { getRelatedLoincLabs } from '../../components/timeline/ObservationResultRow';
import { AIProviderConfig } from '../../features/mere-ai-chat/types';
import { rerankDocuments } from '../../features/mere-ai-chat/services/rerank-documents';
import { SEARCH_CONFIG } from '../../features/mere-ai-chat/constants/config';

interface PreparationOptions {
  maxDocuments: number;
  includeRelated: boolean;
  query?: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  aiConfig?: AIProviderConfig;
}

/**
 * Prepares documents for RAG context
 */
export async function prepareDocumentsForContext(
  documents: ClinicalDocument<BundleEntry<FhirResource>>[],
  relevantChunkIds: string[],
  options: PreparationOptions,
): Promise<PreparedDocuments> {
  let texts = extractTextsFromDocuments(documents);

  if (relevantChunkIds.length > 0) {
    const chunkIdSet = new Set(relevantChunkIds);
    texts = texts.filter((text) => {
      return (
        (text.id && chunkIdSet.has(text.id)) ||
        (text.metadata?.chunkId && chunkIdSet.has(text.metadata.chunkId))
      );
    });
  }

  if (texts.length === 0 && documents.length > 0) {
    texts = extractTextsFromDocuments(documents);
  }

  if (options.includeRelated) {
    const relatedTexts = await fetchRelatedDocumentTexts(
      documents,
      options.db,
      options.user,
    );
    texts.push(...relatedTexts);
  }

  const seenIds = new Set<string>();
  texts = texts.filter((text) => {
    if (seenIds.has(text.id)) {
      return false;
    }
    seenIds.add(text.id);
    return true;
  });

  texts.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  let limitedTexts = texts.slice(0, options.maxDocuments);

  // Apply reranking if AI config is provided and query exists
  if (options.aiConfig && options.query && limitedTexts.length > 0) {
    const shouldSkipReranking =
      (options.aiConfig.aiProvider === 'ollama' &&
        SEARCH_CONFIG.DISABLE_OLLAMA_RERANKING) ||
      options.aiConfig.skipReranking;

    if (!shouldSkipReranking) {
      console.log(
        `[RAG Pipeline] Starting reranking of ${limitedTexts.length} documents with ${options.aiConfig.aiProvider}`,
      );

      try {
        const textContents = limitedTexts.map((t) => t.text);
        const result = await rerankDocuments(
          textContents,
          options.query,
          options.aiConfig,
          SEARCH_CONFIG.RELEVANCE_SCORE_THRESHOLD,
        );

        if (result.rerankingApplied && result.documents.length > 0) {
          const scoreMap = new Map(
            result.documents.map((d) => [d.text, d.relevanceScore]),
          );

          console.log(
            `[RAG Pipeline] Reranking returned ${result.documents.length} documents from original ${limitedTexts.length}`,
          );
          console.log(
            `[RAG Pipeline] Score distribution:`,
            result.documents.slice(0, 5).map((d) => ({
              score: d.relevanceScore,
              reason: d.relevanceReason,
              textPreview: d.text.substring(0, 50) + '...',
            })),
          );

          const previousCount = limitedTexts.length;
          const previousDocIds = limitedTexts.map((t) => t.sourceDocId);

          limitedTexts = limitedTexts
            .filter((t) => scoreMap.has(t.text))
            .map((t) => ({
              ...t,
              metadata: {
                ...t.metadata,
                relevanceScore: scoreMap.get(t.text),
              },
            }))
            .sort(
              (a, b) =>
                (b.metadata?.relevanceScore || 0) -
                (a.metadata?.relevanceScore || 0),
            );

          const afterDocIds = limitedTexts.map((t) => t.sourceDocId);
          console.log(
            `[RAG Pipeline] Reranking complete. Filtered from ${previousCount} to ${limitedTexts.length} documents`,
          );
          console.log(
            `[RAG Pipeline] Document IDs before reranking:`,
            previousDocIds.slice(0, 5),
            previousDocIds.length > 5
              ? `... and ${previousDocIds.length - 5} more`
              : '',
          );
          console.log(
            `[RAG Pipeline] Document IDs after reranking:`,
            afterDocIds.slice(0, 5),
            afterDocIds.length > 5
              ? `... and ${afterDocIds.length - 5} more`
              : '',
          );
          if (limitedTexts.length > 0) {
            console.log(
              `[RAG Pipeline] Top relevance scores: ${limitedTexts
                .slice(0, 3)
                .map((d) => (d.metadata?.relevanceScore || 0).toFixed(2))
                .join(', ')}`,
            );
          }
        } else if (result.documents.length === 0 && textContents.length > 0) {
          console.log(
            '[RAG Pipeline] Reranking filtered out all documents, using fallback',
          );
          // Keep top N documents as fallback
          limitedTexts = limitedTexts.slice(
            0,
            SEARCH_CONFIG.TOP_RESULTS_FALLBACK,
          );
          console.log(
            `[RAG Pipeline] Fallback document IDs:`,
            limitedTexts.map((t) => t.sourceDocId),
          );
        }
      } catch (error) {
        console.error(
          '[RAG Pipeline] Reranking failed, continuing without reranking:',
          error,
        );
      }
    } else {
      const reason = options.aiConfig?.skipReranking
        ? 'model does not support structured output'
        : 'reranking disabled for Ollama';
      console.log(`[RAG Pipeline] Skipping reranking - ${reason}`);
    }
  }

  const sourceDocIds = new Set(limitedTexts.map((t) => t.sourceDocId));
  const sourceDocs = documents.filter((doc) => sourceDocIds.has(doc.id));

  console.log(`[RAG Pipeline] Final document preparation results:`, {
    uniqueSourceDocIds: Array.from(sourceDocIds).slice(0, 10),
    totalUniqueSourceDocs: sourceDocIds.size,
    sourcedocsReturned: sourceDocs.length,
    textChunksReturned: limitedTexts.length,
    originalTextCount: texts.length,
  });

  if (sourceDocs.length !== sourceDocIds.size) {
    console.warn(
      `[RAG Pipeline] WARNING: Document ID mismatch! Expected ${sourceDocIds.size} source docs but got ${sourceDocs.length}`,
      {
        missingIds: Array.from(sourceDocIds).filter(
          (id) => !sourceDocs.find((d) => d.id === id),
        ),
      },
    );
  }

  return {
    texts: limitedTexts,
    sourceDocs,
    totalCount: texts.length,
  };
}

/**
 * Fetches texts from related documents
 */
async function fetchRelatedDocumentTexts(
  documents: ClinicalDocument<BundleEntry<FhirResource>>[],
  db: RxDatabase<DatabaseCollections>,
  user: UserDocument,
): Promise<DocumentText[]> {
  const relatedTexts: DocumentText[] = [];
  const processedIds = new Set<string>(documents.map((d) => d.id));

  for (const doc of documents) {
    const resourceType = doc.data_record?.raw?.resource?.resourceType;
    let relatedDocs: ClinicalDocument<BundleEntry<FhirResource>>[] = [];

    if (resourceType === 'Observation') {
      const loinc = doc.metadata?.loinc_coding || [];
      relatedDocs = await getRelatedLoincLabs({
        loinc,
        db,
        user,
        limit: 3,
      });
    } else if (resourceType === 'DiagnosticReport') {
      const [related] = await getRelatedDocuments({
        db,
        user,
        item: doc as ClinicalDocument<BundleEntry<DiagnosticReport>>,
      });
      relatedDocs = related || [];
    }

    for (const relatedDoc of relatedDocs) {
      if (!processedIds.has(relatedDoc.id)) {
        const texts = extractTextsFromDocuments([relatedDoc]);
        relatedTexts.push(...texts);
        processedIds.add(relatedDoc.id);
      }
    }
  }

  return relatedTexts;
}
