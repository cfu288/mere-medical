import { filterDocuments } from './helpers';
import { IVSDocument } from '../types/IVSDocument';

describe('filterDocuments - user isolation', () => {
  const createDoc = (overrides: Partial<IVSDocument>): IVSDocument => ({
    id: 'default-id',
    text: 'default text',
    metadata: {},
    hash: 'default-hash',
    timestamp: Date.now(),
    ...overrides,
  });

  it('should filter documents by user_id', () => {
    const documents: IVSDocument[] = [
      createDoc({
        id: 'doc-1',
        text: 'Document 1',
        metadata: { user_id: 'user-a', type: 'medical' },
      }),
      createDoc({
        id: 'doc-2',
        text: 'Document 2',
        metadata: { user_id: 'user-b', type: 'medical' },
      }),
      createDoc({
        id: 'doc-3',
        text: 'Document 3',
        metadata: { user_id: 'user-a', type: 'lab' },
      }),
    ];

    const filtered = filterDocuments(documents, {
      include: {
        metadata: { user_id: 'user-a' },
      },
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map(d => d.id).sort()).toEqual(['doc-1', 'doc-3']);
    expect(filtered.every(d => d.metadata?.['user_id'] === 'user-a')).toBe(true);
  });

  it('should prefer top-level user_id over metadata user_id', () => {
    const documents: IVSDocument[] = [
      createDoc({
        id: 'doc-1',
        user_id: 'user-a',
        text: 'Document 1',
        metadata: { user_id: 'user-old', type: 'medical' },
      }),
      createDoc({
        id: 'doc-2',
        user_id: 'user-b',
        text: 'Document 2',
        metadata: { user_id: 'user-old', type: 'medical' },
      }),
    ];

    const filtered = filterDocuments(documents, {
      include: {
        metadata: { user_id: 'user-a' },
      },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('doc-1');
  });
});
