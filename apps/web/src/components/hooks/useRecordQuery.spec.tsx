import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../test-utils/createTestDatabase';
import {
  createDocumentsForDays,
  createDocumentsWithSpecificDates,
} from '../../test-utils/clinicalDocumentTestData';
import { createDefaultTestUser } from '../../test-utils/userTestData';
import {
  fetchRawRecords,
  fetchRecordsUntilCompleteDays,
  getRecordDateKey,
  groupRecordsByDate,
  mergeRecordsByDate,
  PAGE_SIZE,
} from '../../pages/TimelineTab';

describe('useRecordQuery helper functions', () => {
  let db: RxDatabase<DatabaseCollections>;
  let userId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    const user = createDefaultTestUser();
    userId = user.id;
    await db.user_documents.insert(user);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('getRecordDateKey', () => {
    it('extracts date in yyyy-MM-dd format from record with metadata.date', () => {
      const doc = createDocumentsForDays(userId, 1, 1)[0];
      doc.metadata!.date = '2024-01-15T12:30:00.000Z';

      const dateKey = getRecordDateKey(doc);

      expect(dateKey).toBe('2024-01-15');
    });

    it('returns epoch date when metadata.date is missing', () => {
      const doc = createDocumentsForDays(userId, 1, 1)[0];
      doc.metadata = undefined;

      const dateKey = getRecordDateKey(doc);

      expect(dateKey).toBe('1970-01-01');
    });

    it('returns epoch date when metadata.date is empty string', () => {
      const doc = createDocumentsForDays(userId, 1, 1)[0];
      doc.metadata = { date: '' };

      const dateKey = getRecordDateKey(doc);

      expect(dateKey).toBe('1970-01-01');
    });
  });

  describe('groupRecordsByDate', () => {
    it('groups records by their date key', () => {
      const docs = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 3 },
        { date: '2024-01-14T10:00:00Z', count: 2 },
        { date: '2024-01-13T10:00:00Z', count: 4 },
      ]);

      const grouped = groupRecordsByDate(docs);

      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped['2024-01-15']).toHaveLength(3);
      expect(grouped['2024-01-14']).toHaveLength(2);
      expect(grouped['2024-01-13']).toHaveLength(4);
    });

    it('returns empty object for empty array', () => {
      const grouped = groupRecordsByDate([]);

      expect(Object.keys(grouped)).toHaveLength(0);
    });

    it('handles records with missing dates by grouping to epoch', () => {
      const docs = createDocumentsForDays(userId, 1, 2);
      docs[0].metadata = undefined;
      docs[1].metadata = { date: '2024-01-15T10:00:00Z' };

      const grouped = groupRecordsByDate(docs);

      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['1970-01-01']).toHaveLength(1);
      expect(grouped['2024-01-15']).toHaveLength(1);
    });
  });

  describe('mergeRecordsByDate', () => {
    it('returns incoming when existing is undefined', () => {
      const incoming = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 2 },
      ]);
      const incomingGrouped = groupRecordsByDate(incoming);

      const result = mergeRecordsByDate(undefined, incomingGrouped);

      expect(result).toBe(incomingGrouped);
    });

    it('merges records from same date', () => {
      const existing = groupRecordsByDate(
        createDocumentsWithSpecificDates(userId, [
          { date: '2024-01-15T10:00:00Z', count: 2 },
        ]),
      );
      const incoming = groupRecordsByDate(
        createDocumentsWithSpecificDates(userId, [
          { date: '2024-01-15T10:00:00Z', count: 3 },
        ]),
      );

      const result = mergeRecordsByDate(existing, incoming);

      expect(result['2024-01-15']).toHaveLength(5);
    });

    it('adds new dates from incoming', () => {
      const existing = groupRecordsByDate(
        createDocumentsWithSpecificDates(userId, [
          { date: '2024-01-15T10:00:00Z', count: 2 },
        ]),
      );
      const incoming = groupRecordsByDate(
        createDocumentsWithSpecificDates(userId, [
          { date: '2024-01-14T10:00:00Z', count: 3 },
        ]),
      );

      const result = mergeRecordsByDate(existing, incoming);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result['2024-01-15']).toHaveLength(2);
      expect(result['2024-01-14']).toHaveLength(3);
    });

    it('preserves existing dates not in incoming', () => {
      const existing = groupRecordsByDate(
        createDocumentsWithSpecificDates(userId, [
          { date: '2024-01-15T10:00:00Z', count: 2 },
          { date: '2024-01-14T10:00:00Z', count: 3 },
        ]),
      );
      const incoming = groupRecordsByDate(
        createDocumentsWithSpecificDates(userId, [
          { date: '2024-01-13T10:00:00Z', count: 1 },
        ]),
      );

      const result = mergeRecordsByDate(existing, incoming);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['2024-01-15']).toHaveLength(2);
      expect(result['2024-01-14']).toHaveLength(3);
      expect(result['2024-01-13']).toHaveLength(1);
    });
  });

  describe('fetchRawRecords', () => {
    it('fetches records for user sorted by date descending', async () => {
      const docs = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 5 },
        { date: '2024-01-14T10:00:00Z', count: 5 },
        { date: '2024-01-13T10:00:00Z', count: 5 },
      ]);
      await db.clinical_documents.bulkInsert(docs);

      const records = await fetchRawRecords(db, userId, 0, 10);

      expect(records).toHaveLength(10);
      expect(records[0].metadata?.date).toContain('2024-01-15');
    });

    it('respects offset and limit', async () => {
      const docs = createDocumentsForDays(userId, 3, 20);
      await db.clinical_documents.bulkInsert(docs);

      const first10 = await fetchRawRecords(db, userId, 0, 10);
      const next10 = await fetchRawRecords(db, userId, 10, 10);

      expect(first10).toHaveLength(10);
      expect(next10).toHaveLength(10);
      expect(first10[0].id).not.toBe(next10[0].id);
    });

    it('returns empty array when offset exceeds total records', async () => {
      const docs = createDocumentsForDays(userId, 1, 5);
      await db.clinical_documents.bulkInsert(docs);

      const records = await fetchRawRecords(db, userId, 100, 10);

      expect(records).toHaveLength(0);
    });

    it('excludes filtered resource types', async () => {
      const docs = createDocumentsForDays(userId, 1, 5);
      docs[0].data_record.resource_type = 'patient';
      docs[1].data_record.resource_type = 'careplan';
      docs[2].data_record.resource_type = 'allergyintolerance';
      await db.clinical_documents.bulkInsert(docs);

      const records = await fetchRawRecords(db, userId, 0, 10);

      expect(records).toHaveLength(2);
      expect(records.every((r) => r.data_record.resource_type === 'observation')).toBe(true);
    });
  });
});

describe('fetchRecordsUntilCompleteDays', () => {
  let db: RxDatabase<DatabaseCollections>;
  let userId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    const user = createDefaultTestUser();
    userId = user.id;
    await db.user_documents.insert(user);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('fetches at least minDays complete days on initial load', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 20 },
      { date: '2024-01-14T10:00:00Z', count: 20 },
      { date: '2024-01-13T10:00:00Z', count: 20 },
      { date: '2024-01-12T10:00:00Z', count: 20 },
      { date: '2024-01-11T10:00:00Z', count: 20 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    const dayCount = Object.keys(result.records).length;
    expect(dayCount).toBeGreaterThanOrEqual(3);
    expect(result.hasMore).toBe(true);
  });

  it('returns all records when fewer than minDays exist', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 10 },
      { date: '2024-01-14T10:00:00Z', count: 10 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    const dayCount = Object.keys(result.records).length;
    expect(dayCount).toBe(2);
    expect(result.hasMore).toBe(false);
    const totalRecords = Object.values(result.records).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalRecords).toBe(20);
  });

  it('stops at day boundary, not mid-day', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 30 },
      { date: '2024-01-14T10:00:00Z', count: 30 },
      { date: '2024-01-13T10:00:00Z', count: 30 },
      { date: '2024-01-12T10:00:00Z', count: 30 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    for (const [dateKey, records] of Object.entries(result.records)) {
      const expectedCount = dateKey === '2024-01-15' ? 30 :
                           dateKey === '2024-01-14' ? 30 :
                           dateKey === '2024-01-13' ? 30 : 30;
      expect(records.length).toBe(expectedCount);
    }
  });

  it('tracks lastOffset correctly for pagination', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 20 },
      { date: '2024-01-14T10:00:00Z', count: 20 },
      { date: '2024-01-13T10:00:00Z', count: 20 },
      { date: '2024-01-12T10:00:00Z', count: 20 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    const totalRecords = Object.values(result.records).reduce((sum, arr) => sum + arr.length, 0);
    expect(result.lastOffset).toBe(totalRecords);
  });

  it('continues from existingOffset for load more', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 20 },
      { date: '2024-01-14T10:00:00Z', count: 20 },
      { date: '2024-01-13T10:00:00Z', count: 20 },
      { date: '2024-01-12T10:00:00Z', count: 20 },
      { date: '2024-01-11T10:00:00Z', count: 20 },
      { date: '2024-01-10T10:00:00Z', count: 20 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const firstLoad = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);
    const secondLoad = await fetchRecordsUntilCompleteDays(db, userId, 3, firstLoad.lastOffset);

    const firstDates = Object.keys(firstLoad.records);
    const secondDates = Object.keys(secondLoad.records);

    expect(firstDates.some((d) => secondDates.includes(d))).toBe(false);
  });

  it('returns records sorted by date descending', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-13T10:00:00Z', count: 10 },
      { date: '2024-01-15T10:00:00Z', count: 10 },
      { date: '2024-01-14T10:00:00Z', count: 10 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    const dates = Object.keys(result.records);
    expect(dates).toEqual(['2024-01-15', '2024-01-14', '2024-01-13']);
  });
});
