import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';
import { ExtractedChunk } from '../types';

/**
 * Extracts relevant content from documents for RAG context.
 * 
 * Currently returns the full document content when it contains matching chunks.
 * Future enhancement: Extract specific sections based on chunk metadata
 * (offset, size, section name) for more targeted context.
 */
export function extractRelevantChunks(
  document: ClinicalDocument<BundleEntry<FhirResource>>,
  attachmentContent: string | null,
  relevantChunkIds: string[]
): ExtractedChunk[] {
  if (!attachmentContent || relevantChunkIds.length === 0) {
    return [];
  }

  // Return the full document content
  return [{
    documentId: document.id,
    chunkId: document.id,
    content: attachmentContent,
    offset: 0,
    size: attachmentContent.length,
  }];
}

/**
 * Format chunks for inclusion in context
 */
export function formatChunksForContext(chunks: ExtractedChunk[]): string {
  return chunks.map(chunk => chunk.content).join('\n\n---\n\n');
}