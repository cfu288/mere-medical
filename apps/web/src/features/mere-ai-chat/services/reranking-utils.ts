import { createRerankingPrompt } from '../../../domain/rag/prompts';

export interface RerankingDocument {
  text: string;
  relevanceScore: number;
  relevanceReason: string;
}

export { createRerankingPrompt };

/**
 * Creates batches of documents for parallel processing
 */
export function createDocumentBatches(
  documents: string[],
  batchSize = 10,
): { documents: string[]; startIndex: number }[] {
  const batches: { documents: string[]; startIndex: number }[] = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push({
      documents: documents.slice(i, i + batchSize),
      startIndex: i,
    });
  }

  return batches;
}

/**
 * Formats documents for the reranking prompt
 */
export function formatDocumentsForPrompt(documents: string[]): string {
  return documents
    .map((doc, index) => `DOCUMENT ${index + 1}:\n${doc}`)
    .join('\n\n---\n\n');
}


/**
 * Selects top documents using dynamic thresholding
 * Dynamically adjusts threshold to get close to target count while respecting quality
 */
export function selectTopDocumentsWithThreshold(
  rankedDocs: RerankingDocument[],
  targetCount: number,
  minThreshold: number,
): { documents: RerankingDocument[]; threshold: number } {
  // Sort documents by relevance score descending
  const sorted = [...rankedDocs].sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );

  // Handle empty input
  if (sorted.length === 0) {
    return {
      documents: [],
      threshold: minThreshold,
    };
  }

  // First, check how many documents meet the minimum threshold
  const aboveThreshold = sorted.filter((doc) => doc.relevanceScore >= minThreshold);
  
  // Case 1: We have enough documents above threshold
  if (aboveThreshold.length >= targetCount) {
    // Take exactly targetCount from those above threshold
    const selected = aboveThreshold.slice(0, targetCount);
    
    // If there are many documents at the cutoff score, include them all (up to 1.5x target)
    const cutoffScore = selected[selected.length - 1].relevanceScore;
    const allAtCutoff = aboveThreshold.filter(doc => doc.relevanceScore >= cutoffScore);
    
    if (allAtCutoff.length > targetCount * 1.5) {
      // Too many at cutoff, limit to exact target
      return {
        documents: selected,
        threshold: cutoffScore,
      };
    }
    
    return {
      documents: allAtCutoff,
      threshold: cutoffScore,
    };
  }
  
  // Case 2: Not enough documents above threshold
  // We need to lower the threshold to get more documents
  
  // If we have some documents above threshold, start with those
  if (aboveThreshold.length > 0) {
    // Take all above threshold plus some below
    const needed = targetCount - aboveThreshold.length;
    const belowThreshold = sorted.slice(aboveThreshold.length, aboveThreshold.length + needed);
    const combined = [...aboveThreshold, ...belowThreshold];
    
    // The effective threshold is the score of the last document we're including
    const effectiveThreshold = combined.length > 0 
      ? combined[combined.length - 1].relevanceScore 
      : minThreshold;
    
    return {
      documents: combined,
      threshold: effectiveThreshold,
    };
  }
  
  // Case 3: No documents above threshold at all
  // Take the top targetCount documents regardless of threshold
  const selected = sorted.slice(0, Math.min(targetCount, sorted.length));
  
  // The effective threshold is the score of the last document
  const effectiveThreshold = selected.length > 0
    ? selected[selected.length - 1].relevanceScore
    : 0;
  
  return {
    documents: selected,
    threshold: effectiveThreshold,
  };
}
