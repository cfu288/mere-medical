import { DocumentPreparer } from './document-preparer';
import { DocumentPreparerParams, RerankResult } from '../types';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { BundleEntry, FhirResource } from 'fhir/r2';

describe('DocumentPreparer', () => {
  const createMockDocument = (
    id: string,
    text: string,
  ): ClinicalDocument<BundleEntry<FhirResource>> =>
    ({
      id,
      metadata: { display_name: `Doc ${id}` },
      data_record: {
        raw: {
          resource: {
            resourceType: 'Observation',
          },
        },
      },
    }) as any;

  const createBaseParams = (): DocumentPreparerParams => ({
    documents: [],
    context: {
      db: {} as any,
      user: {} as any,
      query: 'test query',
    },
    searchMetadata: {
      relevantChunkIds: [],
      attachmentContentMap: new Map(),
    },
    aiConfig: {
      aiProvider: 'openai',
      openAiKey: 'test-key',
    },
  });

  describe('rerank', () => {
    it('applies reranking when enabled and sorts by relevance score', async () => {
      const doc1 = createMockDocument('1', 'First document');
      const doc2 = createMockDocument('2', 'Second document');
      const doc3 = createMockDocument('3', 'Third document');

      const params = createBaseParams();
      params.documents = [doc1, doc2, doc3];

      const mockReranker = jest.fn().mockResolvedValue({
        rerankingApplied: true,
        documents: [
          {
            text: 'Chunk from Doc 2',
            relevanceScore: 9,
            relevanceReason: 'Highly relevant',
          },
          {
            text: 'Chunk from Doc 1',
            relevanceScore: 7,
            relevanceReason: 'Somewhat relevant',
          },
          {
            text: 'Chunk from Doc 3',
            relevanceScore: 3,
            relevanceReason: 'Less relevant',
          },
        ],
      } as RerankResult);

      const mockVectorizer = jest.fn().mockImplementation((doc) => ({
        docList: [{ id: `${doc.id}-chunk`, text: `Chunk from Doc ${doc.id}` }],
      }));

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
        reranker: mockReranker,
      });

      await preparer.extractTexts();
      await preparer.rerank();
      const result = preparer.build();

      expect(mockReranker).toHaveBeenCalledWith(
        ['Chunk from Doc 1', 'Chunk from Doc 2', 'Chunk from Doc 3'],
        'test query',
        params.aiConfig,
        expect.any(Number),
      );

      expect(result.texts).toEqual([
        'Chunk from Doc 2',
        'Chunk from Doc 1',
        'Chunk from Doc 3',
      ]);
    });

    it('skips reranking when disabled', async () => {
      const params = createBaseParams();
      params.documents = [createMockDocument('1', 'Document')];
      params.options = { enableReranking: false };

      const mockReranker = jest.fn();
      const mockVectorizer = jest.fn().mockImplementation(() => ({
        docList: [{ id: 'chunk-1', text: 'Document chunk' }],
      }));

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
        reranker: mockReranker,
      });

      await preparer.extractTexts();
      await preparer.rerank();

      expect(mockReranker).not.toHaveBeenCalled();
    });

    it('skips reranking when no query provided', async () => {
      const params = createBaseParams();
      params.context.query = undefined;
      params.documents = [createMockDocument('1', 'Document')];

      const mockReranker = jest.fn();
      const mockVectorizer = jest.fn().mockImplementation(() => ({
        docList: [{ id: 'chunk-1', text: 'Document chunk' }],
      }));

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
        reranker: mockReranker,
      });

      await preparer.extractTexts();
      await preparer.rerank();

      expect(mockReranker).not.toHaveBeenCalled();
    });

    it('handles reranking failure gracefully', async () => {
      const params = createBaseParams();
      params.documents = [createMockDocument('1', 'Document')];

      const mockReranker = jest
        .fn()
        .mockRejectedValue(new Error('Reranking failed'));
      const mockVectorizer = jest.fn().mockImplementation(() => ({
        docList: [{ id: 'chunk-1', text: 'Document chunk' }],
      }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
        reranker: mockReranker,
      });

      await preparer.extractTexts();
      await preparer.rerank();
      const result = preparer.build();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[RAG Pipeline] Reranking failed, continuing without reranking:',
        expect.any(Error),
      );
      expect(result.texts).toEqual(['Document chunk']);

      consoleSpy.mockRestore();
    });

    it('filters documents based on relevance threshold', async () => {
      const params = createBaseParams();
      params.documents = [
        createMockDocument('1', 'Doc 1'),
        createMockDocument('2', 'Doc 2'),
        createMockDocument('3', 'Doc 3'),
      ];

      const mockReranker = jest.fn().mockResolvedValue({
        rerankingApplied: true,
        documents: [
          { text: 'Chunk 1', relevanceScore: 8, relevanceReason: 'Good' },
          { text: 'Chunk 3', relevanceScore: 6, relevanceReason: 'OK' },
        ],
      } as RerankResult);

      const mockVectorizer = jest.fn().mockImplementation((doc) => ({
        docList: [{ id: `chunk-${doc.id}`, text: `Chunk ${doc.id}` }],
      }));

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
        reranker: mockReranker,
      });

      await preparer.extractTexts();
      await preparer.rerank();
      const result = preparer.build();

      expect(result.texts).toEqual(['Chunk 1', 'Chunk 3']);
    });
  });

  describe('extractTexts', () => {
    it('extracts relevant chunks from DocumentReference with attachments', async () => {
      const doc = createMockDocument('1', 'Document');
      doc.data_record.raw.resource.resourceType = 'DocumentReference';

      const params = createBaseParams();
      params.documents = [doc];
      params.searchMetadata.relevantChunkIds = ['chunk-1', 'chunk-2'];
      params.searchMetadata.attachmentContentMap?.set(
        '1',
        'Full document content',
      );

      const mockChunkExtractor = {
        extractRelevantChunks: jest.fn().mockReturnValue([
          { chunkId: 'chunk-1', content: 'Relevant section 1' },
          { chunkId: 'chunk-2', content: 'Relevant section 2' },
        ]),
        formatChunksForContext: jest.fn().mockReturnValue('Formatted chunks'),
      };

      const preparer = new DocumentPreparer(params, {
        chunkExtractor: mockChunkExtractor,
      });

      await preparer.extractTexts();
      const result = preparer.build();

      expect(mockChunkExtractor.extractRelevantChunks).toHaveBeenCalledWith(
        doc,
        'Full document content',
        ['chunk-1', 'chunk-2'],
      );
      expect(result.texts[0]).toBe(
        'DocumentReference: Doc 1\nFormatted chunks',
      );
    });

    it('falls back to vectorizer when no relevant chunks found', async () => {
      const doc = createMockDocument('1', 'Document');

      const params = createBaseParams();
      params.documents = [doc];
      params.searchMetadata.relevantChunkIds = ['chunk-999'];

      const mockVectorizer = jest.fn().mockReturnValue({
        docList: [
          { id: 'chunk-1', text: 'Vectorized chunk 1' },
          { id: 'chunk-2', text: 'Vectorized chunk 2' },
        ],
      });

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
      });

      await preparer.extractTexts();
      const result = preparer.build();

      expect(mockVectorizer).toHaveBeenCalledWith(doc);
      expect(result.texts).toEqual([
        'Vectorized chunk 1',
        'Vectorized chunk 2',
      ]);
    });

    it('deduplicates documents by ID', async () => {
      const doc = createMockDocument('1', 'Document');

      const params = createBaseParams();
      params.documents = [doc, doc];

      const mockVectorizer = jest.fn().mockReturnValue({
        docList: [{ id: 'chunk-1', text: 'Chunk text' }],
      });

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
      });

      await preparer.extractTexts();
      const result = preparer.build();

      expect(mockVectorizer).toHaveBeenCalledTimes(1);
      expect(result.texts).toEqual(['Chunk text']);
    });
  });

  describe('fetchRelated', () => {
    it('fetches related documents for Observations', async () => {
      const doc = createMockDocument('1', 'Observation');
      doc.metadata.loinc_coding = ['12345-6'];

      const relatedDoc = createMockDocument('2', 'Related');

      const params = createBaseParams();
      params.documents = [doc];

      const mockVectorizer = jest.fn().mockReturnValue({
        docList: [{ id: 'chunk-1', text: 'Chunk text' }],
      });

      const mockRelatedFetcher = {
        getRelatedLoincLabs: jest.fn().mockResolvedValue([relatedDoc]),
        getRelatedDiagnosticReports: jest.fn(),
      };

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
        relatedFetcher: mockRelatedFetcher,
      });

      await preparer.extractTexts();
      await preparer.fetchRelated();
      const result = preparer.build();

      expect(mockRelatedFetcher.getRelatedLoincLabs).toHaveBeenCalledWith({
        loinc: ['12345-6'],
        db: params.context.db,
        user: params.context.user,
        limit: 3,
      });
      expect(result.sourceDocs).toHaveLength(2);
    });

    it('fetches related documents for DiagnosticReports', async () => {
      const doc = createMockDocument('1', 'DiagnosticReport');
      doc.data_record.raw.resource.resourceType = 'DiagnosticReport';

      const relatedDoc = createMockDocument('2', 'Related');

      const params = createBaseParams();
      params.documents = [doc];

      const mockVectorizer = jest.fn().mockReturnValue({
        docList: [{ id: 'chunk-1', text: 'Chunk text' }],
      });

      const mockRelatedFetcher = {
        getRelatedLoincLabs: jest.fn(),
        getRelatedDiagnosticReports: jest
          .fn()
          .mockResolvedValue([[relatedDoc], false]),
      };

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
        relatedFetcher: mockRelatedFetcher,
      });

      await preparer.extractTexts();
      await preparer.fetchRelated();
      const result = preparer.build();

      expect(
        mockRelatedFetcher.getRelatedDiagnosticReports,
      ).toHaveBeenCalledWith({
        db: params.context.db,
        user: params.context.user,
        item: doc,
      });
      expect(result.sourceDocs).toHaveLength(2);
    });
  });

  describe('deduplicate', () => {
    it('removes duplicate text chunks from same document', async () => {
      const doc1 = createMockDocument('1', 'Doc 1');

      const params = createBaseParams();
      params.documents = [doc1];

      const mockVectorizer = jest.fn().mockReturnValueOnce({
        docList: [
          { id: 'chunk-1', text: 'Duplicate text content' },
          { id: 'chunk-2', text: 'Unique text 1' },
          { id: 'chunk-3', text: 'Duplicate text content' },
          { id: 'chunk-4', text: 'Unique text 2' },
        ],
      });

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
      });

      await preparer.extractTexts();
      preparer.deduplicate();
      const result = preparer.build();

      expect(result.texts).toEqual([
        'Duplicate text content',
        'Unique text 1',
        'Unique text 2',
      ]);
    });

    it('keeps chunk with higher relevance score', async () => {
      const doc = createMockDocument('1', 'Document');

      const params = createBaseParams();
      params.documents = [doc];

      const mockVectorizer = jest.fn().mockReturnValue({
        docList: [],
      });

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
      });

      await preparer.extractTexts();

      // Manually add duplicates with different scores for testing
      (preparer as any).preparedDocuments = [
        {
          text: 'Same text content here',
          sourceDoc: doc,
          metadata: { relevanceScore: 5 },
        },
        {
          text: 'Same text content here',
          sourceDoc: doc,
          metadata: { relevanceScore: 8 },
        },
      ];

      preparer.deduplicate();
      const result = preparer.build();

      expect(result.texts).toEqual(['Same text content here']);
      expect(
        (preparer as any).preparedDocuments[0].metadata.relevanceScore,
      ).toBe(8);
    });
  });

  describe('limit', () => {
    it('limits the number of documents', async () => {
      const params = createBaseParams();
      params.documents = Array.from({ length: 10 }, (_, i) =>
        createMockDocument(`${i}`, `Doc ${i}`),
      );

      const mockVectorizer = jest.fn().mockImplementation((doc) => ({
        docList: [{ id: `chunk-${doc.id}`, text: `Text ${doc.id}` }],
      }));

      const preparer = new DocumentPreparer(params, {
        vectorizer: mockVectorizer,
      });

      await preparer.extractTexts();
      preparer.limit(3);
      const result = preparer.build();

      expect(result.texts).toHaveLength(3);
      expect(result.texts).toEqual(['Text 0', 'Text 1', 'Text 2']);
    });
  });
});
