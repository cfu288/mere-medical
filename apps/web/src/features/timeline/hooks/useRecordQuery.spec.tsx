import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../../test-utils/createTestDatabase';
import {
  createDocumentsForDays,
  createDocumentsWithSpecificDates,
} from '../../../test-utils/clinicalDocumentTestData';
import { createDefaultTestUser } from '../../../test-utils/userTestData';
import {
  fetchRawRecords,
  fetchRecordsUntilCompleteDays,
  getRecordDateKey,
  groupRecordsByDate,
  mergeRecordsByDate,
} from './useRecordQuery';

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
      docs[2].data_record.resource_type = 'provenance';
      docs[3].data_record.resource_type = 'documentreference_attachment';
      await db.clinical_documents.bulkInsert(docs);

      const records = await fetchRawRecords(db, userId, 0, 10);

      expect(records).toHaveLength(1);
      expect(records[0].data_record.resource_type).toBe('observation');
    });

    it('excludes records with empty metadata.date', async () => {
      const docs = createDocumentsForDays(userId, 1, 3);
      docs[0].metadata!.date = '';
      await db.clinical_documents.bulkInsert(docs);

      const records = await fetchRawRecords(db, userId, 0, 10);

      expect(records).toHaveLength(2);
      expect(records.every((r) => r.metadata?.date)).toBe(true);
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

  it('returns at least the requested number of days on initial load', async () => {
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

  it('returns exactly the requested days when data has few records per day', async () => {
    const dates: { date: string; count: number }[] = [];
    const baseDate = new Date('2024-01-15T10:00:00Z');
    for (let i = 0; i < 100; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      dates.push({ date: d.toISOString(), count: 3 });
    }
    const docs = createDocumentsWithSpecificDates(userId, dates);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    expect(Object.keys(result.records).length).toBe(3);
    expect(result.hasMore).toBe(true);

    const totalRecords = Object.values(result.records).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(totalRecords).toBeLessThan(50);
  });

  it('fetches all records when days have many records spanning multiple batches', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 100 },
      { date: '2024-01-14T10:00:00Z', count: 100 },
      { date: '2024-01-13T10:00:00Z', count: 100 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    expect(Object.keys(result.records).length).toBe(3);
    const totalRecords = Object.values(result.records).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(totalRecords).toBe(300);
    expect(result.hasMore).toBe(false);
  });

  it('returns the requested days even when records span multiple batches', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 80 },
      { date: '2024-01-14T10:00:00Z', count: 80 },
      { date: '2024-01-13T10:00:00Z', count: 80 },
      { date: '2024-01-12T10:00:00Z', count: 80 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    expect(Object.keys(result.records).length).toBe(3);
    const totalRecords = Object.values(result.records).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(totalRecords).toBe(240);
    expect(result.hasMore).toBe(true);
  });

  it('load more returns different days than initial load', async () => {
    const dates: { date: string; count: number }[] = [];
    const baseDate = new Date('2024-01-15T10:00:00Z');
    for (let i = 0; i < 20; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      dates.push({ date: d.toISOString(), count: 5 });
    }
    const docs = createDocumentsWithSpecificDates(userId, dates);
    await db.clinical_documents.bulkInsert(docs);

    const firstLoad = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);
    expect(Object.keys(firstLoad.records).length).toBe(3);
    expect(firstLoad.hasMore).toBe(true);

    const secondLoad = await fetchRecordsUntilCompleteDays(
      db,
      userId,
      3,
      firstLoad.lastOffset,
    );
    expect(Object.keys(secondLoad.records).length).toBe(3);

    const firstDates = new Set(Object.keys(firstLoad.records));
    const secondDates = Object.keys(secondLoad.records);
    const overlap = secondDates.filter((d) => firstDates.has(d));
    expect(overlap).toEqual([]);
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
    const totalRecords = Object.values(result.records).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(totalRecords).toBe(20);
  });

  it('never returns partial days', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 30 },
      { date: '2024-01-14T10:00:00Z', count: 30 },
      { date: '2024-01-13T10:00:00Z', count: 30 },
      { date: '2024-01-12T10:00:00Z', count: 30 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    for (const [dateKey, records] of Object.entries(result.records)) {
      const expectedCount =
        dateKey === '2024-01-15'
          ? 30
          : dateKey === '2024-01-14'
            ? 30
            : dateKey === '2024-01-13'
              ? 30
              : 30;
      expect(records.length).toBe(expectedCount);
    }
  });

  it('lastOffset equals total records returned for pagination', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 20 },
      { date: '2024-01-14T10:00:00Z', count: 20 },
      { date: '2024-01-13T10:00:00Z', count: 20 },
      { date: '2024-01-12T10:00:00Z', count: 20 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    const totalRecords = Object.values(result.records).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(result.lastOffset).toBe(totalRecords);
  });

  it('load more returns non-overlapping days', async () => {
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
    const secondLoad = await fetchRecordsUntilCompleteDays(
      db,
      userId,
      3,
      firstLoad.lastOffset,
    );

    const firstDates = Object.keys(firstLoad.records);
    const secondDates = Object.keys(secondLoad.records);

    expect(firstDates.some((d) => secondDates.includes(d))).toBe(false);
  });

  it('returns days in newest-to-oldest order', async () => {
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

  it('on timeout, returns available complete days immediately', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 300 },
      { date: '2024-01-14T10:00:00Z', count: 300 },
      { date: '2024-01-13T10:00:00Z', count: 300 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    let callCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 5000;
    });

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0, 1);

    expect(result.hasMore).toBe(true);
    expect(Object.keys(result.records).length).toBeLessThan(3);
    for (const dateKey of Object.keys(result.records)) {
      expect(['2024-01-15', '2024-01-14', '2024-01-13']).toContain(dateKey);
    }

    dateNowSpy.mockRestore();
  });

  it('fetches all records even past timeout when only one day exists', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 750 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    let callCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount * 2000;
    });

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0, 1);

    expect(result.records['2024-01-15'].length).toBe(750);
    expect(result.hasMore).toBe(false);
    expect(callCount).toBeGreaterThan(3);

    dateNowSpy.mockRestore();
  });

  it('on timeout, excludes partially-loaded days', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 200 },
      { date: '2024-01-14T10:00:00Z', count: 200 },
      { date: '2024-01-13T10:00:00Z', count: 200 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    let callCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 5000;
    });

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0, 1);

    expect(Object.keys(result.records)).toEqual(['2024-01-15']);
    expect(result.records['2024-01-15'].length).toBe(200);
    expect(result.hasMore).toBe(true);
    expect(result.lastOffset).toBe(200);

    dateNowSpy.mockRestore();
  });

  it('shows incremental progress when loading a day with many records', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 750 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    let callCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 5000;
    });

    const partialResults: any[] = [];
    const onPartialResults = jest.fn((partial) => {
      partialResults.push(partial);
    });

    const result = await fetchRecordsUntilCompleteDays(
      db,
      userId,
      3,
      0,
      1,
      onPartialResults,
    );

    expect(onPartialResults).toHaveBeenCalled();
    expect(partialResults.length).toBeGreaterThanOrEqual(1);
    expect(partialResults[0].hasMore).toBe(true);
    expect(Object.keys(partialResults[0].records)).toContain('2024-01-15');

    expect(result.records['2024-01-15'].length).toBe(750);
    expect(result.hasMore).toBe(false);

    dateNowSpy.mockRestore();
  });

  it('incremental progress callback fires each batch until a day completes', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 1000 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    let callCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 5000;
    });

    const onPartialResults = jest.fn();

    await fetchRecordsUntilCompleteDays(db, userId, 3, 0, 1, onPartialResults);

    expect(onPartialResults).toHaveBeenCalledTimes(4);

    const calls = onPartialResults.mock.calls;
    expect(calls[0][0].lastOffset).toBe(250);
    expect(calls[1][0].lastOffset).toBe(500);
    expect(calls[2][0].lastOffset).toBe(750);
    expect(calls[3][0].lastOffset).toBe(1000);

    dateNowSpy.mockRestore();
  });

  it('on timeout with multiple complete days, returns all of them', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 100 },
      { date: '2024-01-14T10:00:00Z', count: 100 },
      { date: '2024-01-13T10:00:00Z', count: 100 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    let callCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 5000;
    });

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0, 1);

    const returnedDates = Object.keys(result.records).sort((a, b) =>
      b.localeCompare(a),
    );
    expect(returnedDates).toEqual(['2024-01-15', '2024-01-14']);
    expect(result.records['2024-01-15'].length).toBe(100);
    expect(result.records['2024-01-14'].length).toBe(100);
    expect(result.hasMore).toBe(true);

    dateNowSpy.mockRestore();
  });

  it('no incremental progress when complete days are available', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 200 },
      { date: '2024-01-14T10:00:00Z', count: 200 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    let callCount = 0;
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 5000;
    });

    const onPartialResults = jest.fn();

    const result = await fetchRecordsUntilCompleteDays(
      db,
      userId,
      3,
      0,
      1,
      onPartialResults,
    );

    expect(onPartialResults).not.toHaveBeenCalled();
    expect(Object.keys(result.records)).toEqual(['2024-01-15']);
    expect(result.hasMore).toBe(true);

    dateNowSpy.mockRestore();
  });

  it('excludes partially-loaded oldest day when more records exist', async () => {
    const docs = createDocumentsWithSpecificDates(userId, [
      { date: '2024-01-15T10:00:00Z', count: 100 },
      { date: '2024-01-14T10:00:00Z', count: 100 },
      { date: '2024-01-13T10:00:00Z', count: 50 },
      { date: '2024-01-12T10:00:00Z', count: 1 },
    ]);
    await db.clinical_documents.bulkInsert(docs);

    const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

    expect(
      Object.keys(result.records).sort((a, b) => b.localeCompare(a)),
    ).toEqual(['2024-01-15', '2024-01-14']);
    expect(result.records['2024-01-15'].length).toBe(100);
    expect(result.records['2024-01-14'].length).toBe(100);
    expect(result.hasMore).toBe(true);
    expect(result.lastOffset).toBe(200);
  });

  describe('boundary conditions', () => {
    it('returns empty when user has no records', async () => {
      const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

      expect(Object.keys(result.records)).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.lastOffset).toBe(0);
    });

    it('returns all days when exactly minDays exist', async () => {
      const docs = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 10 },
        { date: '2024-01-14T10:00:00Z', count: 10 },
        { date: '2024-01-13T10:00:00Z', count: 10 },
      ]);
      await db.clinical_documents.bulkInsert(docs);

      const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

      expect(Object.keys(result.records)).toHaveLength(3);
      expect(result.hasMore).toBe(false);
    });

    it('handles exactly GROUPED_VIEW_BATCH_SIZE records (250)', async () => {
      const docs = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 100 },
        { date: '2024-01-14T10:00:00Z', count: 100 },
        { date: '2024-01-13T10:00:00Z', count: 50 },
      ]);
      await db.clinical_documents.bulkInsert(docs);

      const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

      expect(Object.keys(result.records).length).toBe(3);
      const totalRecords = Object.values(result.records).reduce(
        (sum, arr) => sum + arr.length,
        0,
      );
      expect(totalRecords).toBe(250);
      expect(result.hasMore).toBe(false);
    });

    it('handles GROUPED_VIEW_BATCH_SIZE - 1 records (249)', async () => {
      const docs = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 100 },
        { date: '2024-01-14T10:00:00Z', count: 100 },
        { date: '2024-01-13T10:00:00Z', count: 49 },
      ]);
      await db.clinical_documents.bulkInsert(docs);

      const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

      expect(Object.keys(result.records).length).toBe(3);
      const totalRecords = Object.values(result.records).reduce(
        (sum, arr) => sum + arr.length,
        0,
      );
      expect(totalRecords).toBe(249);
      expect(result.hasMore).toBe(false);
    });

    it('handles GROUPED_VIEW_BATCH_SIZE + 1 records (251)', async () => {
      const docs = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 100 },
        { date: '2024-01-14T10:00:00Z', count: 100 },
        { date: '2024-01-13T10:00:00Z', count: 51 },
      ]);
      await db.clinical_documents.bulkInsert(docs);

      const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

      expect(Object.keys(result.records)).toHaveLength(3);
      const totalRecords = Object.values(result.records).reduce(
        (sum, arr) => sum + arr.length,
        0,
      );
      expect(totalRecords).toBe(251);
      expect(result.hasMore).toBe(false);
    });

    it('returns single day when only one record exists', async () => {
      const docs = createDocumentsWithSpecificDates(userId, [
        { date: '2024-01-15T10:00:00Z', count: 1 },
      ]);
      await db.clinical_documents.bulkInsert(docs);

      const result = await fetchRecordsUntilCompleteDays(db, userId, 3, 0);

      expect(Object.keys(result.records)).toHaveLength(1);
      expect(result.records['2024-01-15']).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('fuzz testing - pagination integrity', () => {
    function generateRandomDateDistribution(
      seed: number,
    ): { date: string; count: number }[] {
      const random = (max: number) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % max;
      };

      const numDays = 3 + random(15);
      const baseDate = new Date('2024-01-15T10:00:00Z');
      const dates: { date: string; count: number }[] = [];

      for (let i = 0; i < numDays; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        const count = 1 + random(150);
        dates.push({ date: d.toISOString(), count });
      }

      return dates;
    }

    async function getAllRecordsPaged(
      db: RxDatabase<DatabaseCollections>,
      userId: string,
      minDays: number,
    ): Promise<string[]> {
      const allIds: string[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await fetchRecordsUntilCompleteDays(
          db,
          userId,
          minDays,
          offset,
        );
        for (const records of Object.values(result.records)) {
          for (const record of records) {
            allIds.push(record.id!);
          }
        }
        offset = result.lastOffset;
        hasMore = result.hasMore;

        if (allIds.length > 10000) {
          throw new Error('Safety limit exceeded');
        }
      }

      return allIds;
    }

    async function getAllRecordsUnpaged(
      db: RxDatabase<DatabaseCollections>,
      userId: string,
    ): Promise<string[]> {
      const records = await fetchRawRecords(db, userId, 0, 100000);
      return records.map((r) => r.id!);
    }

    it.each([42, 123, 456, 789, 1001])(
      'all records are returned across multiple load-more calls (seed %i)',
      async (seed) => {
        const dates = generateRandomDateDistribution(seed);
        const totalExpected = dates.reduce((sum, d) => sum + d.count, 0);
        const docs = createDocumentsWithSpecificDates(userId, dates);
        await db.clinical_documents.bulkInsert(docs);

        const pagedIds = await getAllRecordsPaged(db, userId, 3);
        const unpagedIds = await getAllRecordsUnpaged(db, userId);

        const pagedSet = new Set(pagedIds);
        const unpagedSet = new Set(unpagedIds);

        expect(pagedIds.length).toBe(totalExpected);
        expect(unpagedIds.length).toBe(totalExpected);

        expect(pagedIds.length).toBe(pagedSet.size);

        const missingFromPaged = unpagedIds.filter((id) => !pagedSet.has(id));
        const extraInPaged = pagedIds.filter((id) => !unpagedSet.has(id));

        expect(missingFromPaged).toEqual([]);
        expect(extraInPaged).toEqual([]);
      },
    );

    it('all records are returned regardless of minDays setting', async () => {
      const dates = generateRandomDateDistribution(999);
      const docs = createDocumentsWithSpecificDates(userId, dates);
      await db.clinical_documents.bulkInsert(docs);

      const unpagedIds = await getAllRecordsUnpaged(db, userId);

      for (const minDays of [1, 2, 3, 5, 7]) {
        const pagedIds = await getAllRecordsPaged(db, userId, minDays);
        const pagedSet = new Set(pagedIds);

        expect(pagedIds.length).toBe(pagedSet.size);
        expect(pagedIds.length).toBe(unpagedIds.length);

        const missing = unpagedIds.filter((id) => !pagedSet.has(id));
        expect(missing).toEqual([]);
      }
    });
  });
});
