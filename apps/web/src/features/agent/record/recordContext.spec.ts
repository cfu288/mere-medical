import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import * as clinicalDocumentRepository from '../../../repositories/ClinicalDocumentRepository';
import { createRecordContextCache, RecordContextCache } from './recordContext';

function note(id: string, userId = 'user-a'): ClinicalDocument {
  return {
    id: `conn-1|${userId}|DocumentReference/${id}`,
    user_id: userId,
    connection_record_id: 'conn-1',
    data_record: {
      raw: { resource: { resourceType: 'DocumentReference', id } },
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'documentreference',
      version_history: [],
    },
    metadata: {
      id: `DocumentReference/${id}`,
      date: '2024-03-01T00:00:00.000Z',
      display_name: `Note ${id}`,
    },
  };
}

describe('createRecordContextCache', () => {
  let db: RxDatabase<DatabaseCollections>;
  let cache: RecordContextCache;

  beforeEach(async () => {
    db = await createTestDatabase();
    cache = createRecordContextCache(db, 'user-a');
  });

  afterEach(async () => {
    cache.dispose();
    jest.restoreAllMocks();
    await cleanupTestDatabase(db);
  });

  it('builds the context once while the records stay the same', async () => {
    await db.clinical_documents.insert(note('note-1'));
    const load = jest.spyOn(clinicalDocumentRepository, 'findAllDocuments');

    const first = await cache.get();
    const second = await cache.get();

    expect(second).toBe(first);
    expect(first.notes.map((n) => n.displayName)).toEqual(['Note note-1']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('rebuilds after one of the user records changes', async () => {
    await db.clinical_documents.insert(note('note-1'));
    const first = await cache.get();

    await db.clinical_documents.insert(note('note-2'));
    const second = await cache.get();

    expect(second).not.toBe(first);
    expect(second.notes).toHaveLength(2);
  });

  it('keeps the context when another user record changes', async () => {
    const first = await cache.get();

    await db.clinical_documents.insert(note('note-1', 'user-b'));

    expect(await cache.get()).toBe(first);
  });

  it('builds again after a build fails', async () => {
    jest
      .spyOn(clinicalDocumentRepository, 'findAllDocuments')
      .mockRejectedValueOnce(new Error('database closed'));

    await expect(cache.get()).rejects.toThrow('database closed');
    expect((await cache.get()).notes).toEqual([]);
  });
});
