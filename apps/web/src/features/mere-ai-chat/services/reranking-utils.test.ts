import {
  selectTopDocumentsWithThreshold,
  RerankingDocument,
} from './reranking-utils';

describe('selectTopDocumentsWithThreshold', () => {
  // Helper to create test documents
  const createDoc = (
    score: number,
    text: string = `doc-${score}`,
  ): RerankingDocument => ({
    text,
    relevanceScore: score,
    relevanceReason: `Score ${score}`,
  });

  describe('when documents are fewer than target', () => {
    it('should return all documents when fewer than target exist', () => {
      const docs = [createDoc(8), createDoc(6), createDoc(4), createDoc(2)];

      const result = selectTopDocumentsWithThreshold(docs, 10, 5);

      // Want 10 docs but only have 4 - return all 4 even though one is below threshold
      expect(result.documents).toHaveLength(4);
      expect(result.documents[0].relevanceScore).toBe(8);
      expect(result.documents[1].relevanceScore).toBe(6);
      expect(result.documents[2].relevanceScore).toBe(4);
      expect(result.documents[3].relevanceScore).toBe(2);
      expect(result.threshold).toBe(2); // Effective threshold lowered to include all
    });

    it('should return all documents even when all are below threshold', () => {
      const docs = [createDoc(4), createDoc(3), createDoc(2), createDoc(1)];

      const result = selectTopDocumentsWithThreshold(docs, 10, 5);

      // Want 10, have 4, all below threshold of 5 - still return all 4
      expect(result.documents).toHaveLength(4);
      expect(result.threshold).toBe(1); // Effective threshold is lowest score
    });

    it('should lower threshold to return target documents when too few pass', () => {
      const docs = [
        createDoc(8),
        createDoc(4),
        createDoc(3),
        createDoc(2),
        createDoc(1),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 3, 5);

      // Only 1 doc (score 8) meets threshold of 5, but we need 3 docs
      expect(result.documents).toHaveLength(3);
      expect(result.documents[0].relevanceScore).toBe(8);
      expect(result.documents[1].relevanceScore).toBe(4);
      expect(result.documents[2].relevanceScore).toBe(3);
      expect(result.threshold).toBe(3); // Threshold dynamically lowered to 3
    });
  });

  describe('when documents are more than target', () => {
    it('should select exactly target count when scores are well distributed', () => {
      const docs = [
        createDoc(10),
        createDoc(9),
        createDoc(8),
        createDoc(7),
        createDoc(6),
        createDoc(5),
        createDoc(4),
        createDoc(3),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 3, 5);

      expect(result.documents).toHaveLength(3);
      expect(result.documents[0].relevanceScore).toBe(10);
      expect(result.documents[1].relevanceScore).toBe(9);
      expect(result.documents[2].relevanceScore).toBe(8);
      expect(result.threshold).toBe(8);
    });

    it('should include all documents at threshold score', () => {
      const docs = [
        createDoc(10),
        createDoc(8),
        createDoc(8),
        createDoc(8),
        createDoc(5),
        createDoc(3),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 3, 5);

      // Should include all score-8 documents
      expect(result.documents).toHaveLength(4);
      expect(
        result.documents.filter((d) => d.relevanceScore === 8),
      ).toHaveLength(3);
      expect(result.threshold).toBe(8);
    });

    it('should limit to target when too many documents cluster at threshold', () => {
      const docs = [
        createDoc(10),
        createDoc(7),
        createDoc(7),
        createDoc(7),
        createDoc(7),
        createDoc(7),
        createDoc(3),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 3, 5);

      // Too many at score 7 (more than 3 * 1.5 = 4.5), so limit to exactly 3
      expect(result.documents).toHaveLength(3);
      expect(result.documents[0].relevanceScore).toBe(10);
      expect(result.documents[1].relevanceScore).toBe(7);
      expect(result.documents[2].relevanceScore).toBe(7);
    });

    it('should get target docs even when none meet high threshold', () => {
      const docs = [
        createDoc(6),
        createDoc(4),
        createDoc(3),
        createDoc(2),
        createDoc(1),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 3, 7);

      // Threshold is 7 but highest doc is 6 - still return top 3
      expect(result.documents).toHaveLength(3);
      expect(result.documents[0].relevanceScore).toBe(6);
      expect(result.documents[1].relevanceScore).toBe(4);
      expect(result.documents[2].relevanceScore).toBe(3);
      expect(result.threshold).toBe(3); // Effective threshold is 3rd doc's score
    });

    it('should guarantee minimum documents even below threshold', () => {
      const docs = [
        createDoc(4),
        createDoc(3),
        createDoc(2),
        createDoc(1),
        createDoc(0),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 3, 5);

      // All docs below threshold of 5 - still return top 3 to meet target
      expect(result.documents).toHaveLength(3);
      expect(result.documents[0].relevanceScore).toBe(4);
      expect(result.documents[1].relevanceScore).toBe(3);
      expect(result.documents[2].relevanceScore).toBe(2);
      expect(result.threshold).toBe(2); // Effective threshold is 3rd doc's score
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = selectTopDocumentsWithThreshold([], 5, 3);

      expect(result.documents).toHaveLength(0);
      expect(result.threshold).toBe(3);
    });

    it('should handle single document above threshold', () => {
      const docs = [createDoc(8)];

      const result = selectTopDocumentsWithThreshold(docs, 5, 5);

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].relevanceScore).toBe(8);
      expect(result.threshold).toBe(8); // Effective threshold
    });

    it('should handle single document below threshold', () => {
      const docs = [createDoc(3)];

      const result = selectTopDocumentsWithThreshold(docs, 5, 5);

      // Return the single document even though below threshold
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].relevanceScore).toBe(3);
      expect(result.threshold).toBe(3); // Effective threshold
    });

    it('should handle all documents with same score above threshold', () => {
      const docs = [
        createDoc(7, 'doc-a'),
        createDoc(7, 'doc-b'),
        createDoc(7, 'doc-c'),
        createDoc(7, 'doc-d'),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 2, 5);

      // When all have same score above threshold and we want 2,
      // we take all at that score (up to 1.5x target = 3)
      // But since we have 4 at score 7 (> 3), limit to exactly 2
      expect(result.documents).toHaveLength(2);
      expect(result.documents[0].relevanceScore).toBe(7);
      expect(result.documents[1].relevanceScore).toBe(7);
      expect(result.threshold).toBe(7);
    });

    it('should handle all documents with same score below threshold', () => {
      const docs = [createDoc(3), createDoc(3), createDoc(3), createDoc(3)];

      const result = selectTopDocumentsWithThreshold(docs, 2, 5);

      // Return target count even if all below threshold
      expect(result.documents).toHaveLength(2);
      expect(result.documents[0].relevanceScore).toBe(3);
      expect(result.threshold).toBe(3); // Effective threshold
    });
  });

  describe('real-world scenarios', () => {
    it('should handle anemia query with mixed relevance scores', () => {
      const docs = [
        createDoc(8, 'Hemoglobin test result'),
        createDoc(6, 'RBC count'),
        createDoc(6, 'Hematocrit level'),
        createDoc(4, 'Iron studies'),
        createDoc(3, 'Complete blood count'),
        createDoc(2, 'Vitamin B12'),
        createDoc(1, 'Unrelated test'),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 5, 5);

      // Should return at least 3 docs (could be more if tied at threshold)
      expect(result.documents.length).toBeGreaterThanOrEqual(3);
      expect(result.documents[0].text).toBe('Hemoglobin test result');
    });

    it('should handle case where reranking scores are generally low', () => {
      // Simulates reranking models that tend to give low scores
      const docs = [
        createDoc(4, 'Somewhat relevant'),
        createDoc(3, 'Maybe relevant'),
        createDoc(2, 'Slightly relevant'),
        createDoc(2, 'Possibly relevant'),
        createDoc(1, 'Barely relevant'),
      ];

      const result = selectTopDocumentsWithThreshold(docs, 3, 5);

      // All scores below threshold of 5 - still return target of 3 docs
      expect(result.documents).toHaveLength(3);
    });
  });
});
