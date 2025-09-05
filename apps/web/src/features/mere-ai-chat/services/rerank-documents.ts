import { AIProviderConfig, RerankResult } from '../types';
import { callAIProvider } from './ai-operations-core';
import {
  createRerankingPrompt,
  createDocumentBatches,
  formatDocumentsForPrompt,
  selectTopDocumentsWithThreshold,
  RerankingDocument,
} from './reranking-utils';

const BATCH_SIZE = 5;
const MAX_PARALLEL_BATCHES = 4;

export async function rerankDocuments(
  documents: string[],
  query: string,
  config: AIProviderConfig,
  relevanceThreshold = 5,
  targetDocuments = 25,
): Promise<RerankResult> {
  if (documents.length === 0) {
    return {
      rerankingApplied: false,
      documents: [],
    };
  }

  try {
    const systemPrompt = createRerankingPrompt(query);
    const batches = createDocumentBatches(documents, BATCH_SIZE);
    
    let allRankedDocs: RerankingDocument[] = [];
    
    if (batches.length <= MAX_PARALLEL_BATCHES) {
      const batchPromises = batches.map(batch => 
        processBatch(batch, systemPrompt, config, documents)
      );
      
      const batchResults = await Promise.all(batchPromises);
      allRankedDocs = batchResults.flat();
    } else {
      for (const batch of batches) {
        const batchResult = await processBatch(batch, systemPrompt, config, documents);
        allRankedDocs.push(...batchResult);
      }
    }
    
    const { documents: selectedDocs, threshold } = selectTopDocumentsWithThreshold(
      allRankedDocs,
      targetDocuments,
      relevanceThreshold
    );
    
    return {
      rerankingApplied: true,
      documents: selectedDocs.map(doc => ({
        text: doc.text,
        relevanceScore: doc.relevanceScore,
        relevanceReason: doc.relevanceReason,
      })),
    };
    
  } catch (error) {
    console.error('[Reranking] Error:', error);
    console.log('[Reranking] Returning all documents unmodified due to error');
    
    return {
      rerankingApplied: false,
      documents: documents.map((text) => ({
        text,
        relevanceScore: 5,
        relevanceReason: 'Fallback - ranking unavailable',
      })),
    };
  }
}

async function processBatch(
  batch: { documents: string[]; startIndex: number },
  systemPrompt: string,
  config: AIProviderConfig,
  allDocuments: string[]
): Promise<RerankingDocument[]> {
  const userPrompt = `Evaluate these documents:\n\n${formatDocumentsForPrompt(batch.documents)}`;
  
  const createFallbackDocuments = (reason: string) => {
    console.log(`[Reranking] Using fallback scores: ${reason}`);
    return batch.documents.map((doc, index) => ({
      text: doc,
      relevanceScore: 5 + (batch.documents.length - index) * 0.1,
      relevanceReason: `Fallback - ${reason}`,
    }));
  };
  
  const attemptReranking = async (isRetry: boolean = false, previousError?: string): Promise<RerankingDocument[]> => {
    const finalSystemPrompt = isRetry && previousError
      ? `${systemPrompt}\n\nYour previous response had an error: ${previousError}\nPlease correct it and return the proper format.`
      : systemPrompt;
    
    try {
      const response = await callAIProvider({
        ...config,
        systemPrompt: finalSystemPrompt,
        userPrompt,
        temperature: 0.1,
        expectJson: true,
        useRerankingModel: true,
      });
      
      // Parse the unified map format response {"1": 8, "2": 3, "3": 9, "4": 2, "5": 7}
      let scoreMap: Record<string, number>;
      
      if (typeof response === 'object' && response !== null) {
        scoreMap = response as Record<string, number>;
      } else if (typeof response === 'string') {
        try {
          scoreMap = JSON.parse(response);
        } catch (e) {
          const error = `Invalid JSON format. Expected {"1": score, "2": score, ...}`;
          if (!isRetry) {
            console.log('[Reranking] Parse error, retrying with feedback:', error);
            return attemptReranking(true, error);
          }
          throw new Error(error);
        }
      } else {
        const error = `Unexpected response type: ${typeof response}. Expected JSON object.`;
        if (!isRetry) {
          console.log('[Reranking] Type error, retrying with feedback:', error);
          return attemptReranking(true, error);
        }
        throw new Error(error);
      }
      
      // Validate and convert map to array
      const results: RerankingDocument[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < batch.documents.length; i++) {
        const docNum = (i + 1).toString();
        const score = scoreMap[docNum];
        
        if (score === undefined || score === null) {
          errors.push(`Missing score for document ${docNum}`);
          continue;
        }
        
        if (typeof score !== 'number' || score < 0 || score > 10) {
          errors.push(`Invalid score for document ${docNum}: ${score} (must be 0-10)`);
          continue;
        }
        
        results.push({
          text: batch.documents[i],
          relevanceScore: score,
          relevanceReason: 'Model score',
        });
      }
      
      if (errors.length > 0) {
        const errorMsg = errors.join('; ');
        if (!isRetry) {
          console.log('[Reranking] Validation errors, retrying with feedback:', errorMsg);
          return attemptReranking(true, errorMsg);
        }
        throw new Error(errorMsg);
      }
      
      return results;
    } catch (error) {
      if (!isRetry) {
        console.log(`[Reranking] Error on first attempt, retrying: ${error}`);
        return attemptReranking(true, String(error));
      }
      throw error;
    }
  };
  
  try {
    return await attemptReranking();
  } catch (error) {
    console.error(`[Reranking] Failed after retry:`, error);
    return createFallbackDocuments('failed after retry');
  }
}

export type { RerankResult } from '../types';