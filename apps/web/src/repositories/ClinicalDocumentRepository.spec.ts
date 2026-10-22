import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../models/clinical-document/ClinicalDocument.type';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../test-utils/createTestDatabase';
import {
  findAttachment,
  findDatedRecordsByType,
  findRecordsByIds,
  findRecordsByLoincCodes,
  findRecordsByMetadataIds,
  findRecordsByType,
  findTimelineRecords,
} from './ClinicalDocumentRepository';

function clinicalDoc({
  metadataId,
  type,
  date,
  name = metadataId,
  userId = 'user-a',
  connectionId = 'conn-1',
  loinc,
}: {
  metadataId: string;
  type: ClinicalDocumentResourceType;
  date?: string;
  name?: string;
  userId?: string;
  connectionId?: string;
  loinc?: string[];
}): ClinicalDocument {
  return {
    id: `${connectionId}|${userId}|${metadataId}`,
    user_id: userId,
    connection_record_id: connectionId,
    data_record: {
      raw: { resource: { resourceType: 'Basic', id: metadataId } },
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: type,
      version_history: [],
    },
    metadata: {
      id: metadataId,
      date,
      display_name: name,
      ...(loinc ? { loinc_coding: loinc } : {}),
    },
  };
}

describe('ClinicalDocumentRepository', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('findTimelineRecords', () => {
    const newest = clinicalDoc({
      metadataId: 'cond-1',
      type: 'condition',
      date: '2024-03-01T00:00:00.000Z',
      name: 'Asthma',
    });
    const middle = clinicalDoc({
      metadataId: 'obs-1',
      type: 'observation',
      date: '2024-02-01T00:00:00.000Z',
      name: 'Glucose',
    });
    const oldest = clinicalDoc({
      metadataId: 'proc-1',
      type: 'procedure',
      date: '2024-01-01T00:00:00.000Z',
      name: 'Asthma education',
    });

    it('returns the user dated records newest first', async () => {
      await db.clinical_documents.bulkInsert([oldest, newest, middle]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 0,
        limit: 10,
      });

      expect(result).toEqual([newest, middle, oldest]);
    });

    it('leaves out patients, care plans, attachments and provenance', async () => {
      await db.clinical_documents.bulkInsert([
        newest,
        clinicalDoc({
          metadataId: 'pat-1',
          type: 'patient',
          date: '2024-03-02T00:00:00.000Z',
        }),
        clinicalDoc({
          metadataId: 'plan-1',
          type: 'careplan',
          date: '2024-03-02T00:00:00.000Z',
        }),
        clinicalDoc({
          metadataId: 'att-1',
          type: 'documentreference_attachment',
          date: '2024-03-02T00:00:00.000Z',
        }),
        clinicalDoc({
          metadataId: 'prov-1',
          type: 'provenance',
          date: '2024-03-02T00:00:00.000Z',
        }),
      ]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 0,
        limit: 10,
      });

      expect(result).toEqual([newest]);
    });

    it('leaves out records with an empty date', async () => {
      await db.clinical_documents.bulkInsert([
        newest,
        clinicalDoc({ metadataId: 'cond-2', type: 'condition', date: '' }),
      ]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 0,
        limit: 10,
      });

      expect(result).toEqual([newest]);
    });

    it('returns only the records of the given user', async () => {
      await db.clinical_documents.bulkInsert([
        newest,
        clinicalDoc({
          metadataId: 'cond-1',
          type: 'condition',
          date: '2024-03-01T00:00:00.000Z',
          userId: 'user-b',
        }),
      ]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 0,
        limit: 10,
      });

      expect(result).toEqual([newest]);
    });

    it('returns the page after the skipped records', async () => {
      await db.clinical_documents.bulkInsert([oldest, newest, middle]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 1,
        limit: 1,
      });

      expect(result).toEqual([middle]);
    });

    it('matches the search text anywhere in the name, ignoring case', async () => {
      await db.clinical_documents.bulkInsert([oldest, newest, middle]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 0,
        limit: 10,
        search: 'asTHma',
      });

      expect(result).toEqual([newest, oldest]);
    });

    it('matches regular expression characters in the search text literally', async () => {
      const hba1c = clinicalDoc({
        metadataId: 'obs-2',
        type: 'observation',
        date: '2024-02-02T00:00:00.000Z',
        name: 'HbA1c (%)',
      });
      await db.clinical_documents.bulkInsert([middle, hba1c]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 0,
        limit: 10,
        search: '(%)',
      });

      expect(result).toEqual([hba1c]);
    });

    it('reads blank search text as no search', async () => {
      await db.clinical_documents.bulkInsert([oldest, newest, middle]);

      const result = await findTimelineRecords(db, 'user-a', {
        skip: 0,
        limit: 10,
        search: '   ',
      });

      expect(result).toEqual([newest, middle, oldest]);
    });
  });

  describe('findRecordsByLoincCodes', () => {
    it('returns the user records that carry any of the codes', async () => {
      const glucose = clinicalDoc({
        metadataId: 'obs-1',
        type: 'observation',
        date: '2024-01-01T00:00:00.000Z',
        loinc: ['2345-7'],
      });
      const a1c = clinicalDoc({
        metadataId: 'obs-2',
        type: 'observation',
        date: '2024-01-01T00:00:00.000Z',
        loinc: ['4548-4'],
      });
      await db.clinical_documents.bulkInsert([
        glucose,
        a1c,
        clinicalDoc({
          metadataId: 'obs-3',
          type: 'observation',
          date: '2024-01-01T00:00:00.000Z',
          loinc: ['2093-3'],
        }),
        clinicalDoc({
          metadataId: 'obs-4',
          type: 'observation',
          date: '2024-01-01T00:00:00.000Z',
          loinc: ['2345-7'],
          userId: 'user-b',
        }),
      ]);

      const result = await findRecordsByLoincCodes(db, 'user-a', [
        '2345-7',
        '4548-4',
      ]);

      expect(result).toEqual([glucose, a1c]);
    });

    it('returns nothing for no codes', async () => {
      await db.clinical_documents.insert(
        clinicalDoc({
          metadataId: 'obs-1',
          type: 'observation',
          loinc: ['2345-7'],
        }),
      );

      const result = await findRecordsByLoincCodes(db, 'user-a', []);

      expect(result).toEqual([]);
    });
  });

  describe('findRecordsByMetadataIds', () => {
    it('returns the user records of one connection with any of the ids', async () => {
      const glucose = clinicalDoc({
        metadataId: 'https://fhir.example.org/Observation/1',
        type: 'observation',
      });
      await db.clinical_documents.bulkInsert([
        glucose,
        clinicalDoc({
          metadataId: 'https://fhir.example.org/Observation/1',
          type: 'observation',
          connectionId: 'conn-2',
        }),
        clinicalDoc({
          metadataId: 'https://fhir.example.org/Observation/1',
          type: 'observation',
          userId: 'user-b',
        }),
        clinicalDoc({
          metadataId: 'https://fhir.example.org/Observation/2',
          type: 'observation',
        }),
      ]);

      const result = await findRecordsByMetadataIds(db, 'user-a', 'conn-1', [
        'Observation/1',
        'https://fhir.example.org/Observation/1',
      ]);

      expect(result).toEqual([glucose]);
    });
  });

  describe('findDatedRecordsByType', () => {
    it('returns the user dated records of the given types newest first', async () => {
      const statement = clinicalDoc({
        metadataId: 'med-1',
        type: 'medicationstatement',
        date: '2024-01-01T00:00:00.000Z',
      });
      const request = clinicalDoc({
        metadataId: 'med-2',
        type: 'medicationrequest',
        date: '2024-02-01T00:00:00.000Z',
      });
      await db.clinical_documents.bulkInsert([
        statement,
        request,
        clinicalDoc({
          metadataId: 'med-3',
          type: 'medicationorder',
          date: '2024-03-01T00:00:00.000Z',
        }),
        clinicalDoc({
          metadataId: 'med-4',
          type: 'medicationstatement',
          date: '',
        }),
        clinicalDoc({
          metadataId: 'med-5',
          type: 'medicationstatement',
          date: '2024-03-01T00:00:00.000Z',
          userId: 'user-b',
        }),
      ]);

      const result = await findDatedRecordsByType(db, 'user-a', [
        'medicationstatement',
        'medicationrequest',
      ]);

      expect(result).toEqual([request, statement]);
    });
  });

  describe('findRecordsByType', () => {
    it('returns the user records of the given types newest first, dated or not', async () => {
      const older = clinicalDoc({
        metadataId: 'plan-1',
        type: 'careplan',
        date: '2023-01-01T00:00:00.000Z',
      });
      const newer = clinicalDoc({
        metadataId: 'plan-2',
        type: 'careplan',
        date: '2024-01-01T00:00:00.000Z',
      });
      const undated = clinicalDoc({
        metadataId: 'plan-3',
        type: 'careplan',
        date: '',
      });
      await db.clinical_documents.bulkInsert([
        older,
        undated,
        newer,
        clinicalDoc({
          metadataId: 'plan-4',
          type: 'careplan',
          date: '2024-06-01T00:00:00.000Z',
          userId: 'user-b',
        }),
        clinicalDoc({
          metadataId: 'cond-1',
          type: 'condition',
          date: '2024-06-01T00:00:00.000Z',
        }),
      ]);

      const result = await findRecordsByType(db, 'user-a', ['careplan']);

      expect(result).toEqual([newer, older, undated]);
    });
  });

  describe('findRecordsByIds', () => {
    it('returns the user records in the order of the ids', async () => {
      const first = clinicalDoc({ metadataId: 'obs-1', type: 'observation' });
      const second = clinicalDoc({ metadataId: 'obs-2', type: 'observation' });
      await db.clinical_documents.bulkInsert([
        first,
        second,
        clinicalDoc({
          metadataId: 'obs-3',
          type: 'observation',
          userId: 'user-b',
        }),
      ]);

      const result = await findRecordsByIds(db, 'user-a', [
        'conn-1|user-a|obs-2',
        'conn-1|user-b|obs-3',
        'conn-1|user-a|missing',
        'conn-1|user-a|obs-1',
      ]);

      expect(result).toEqual([second, first]);
    });

    it('returns nothing for no ids', async () => {
      await db.clinical_documents.insert(
        clinicalDoc({ metadataId: 'obs-1', type: 'observation' }),
      );

      const result = await findRecordsByIds(db, 'user-a', []);

      expect(result).toEqual([]);
    });
  });

  describe('findAttachment', () => {
    it('returns the attachment of one user and connection with the id', async () => {
      const attachment = clinicalDoc({
        metadataId: 'https://fhir.example.org/Binary/1',
        type: 'documentreference_attachment',
      });
      await db.clinical_documents.bulkInsert([
        clinicalDoc({
          metadataId: 'https://fhir.example.org/Binary/1',
          type: 'documentreference_attachment',
          userId: 'user-b',
        }),
        clinicalDoc({
          metadataId: 'https://fhir.example.org/Binary/1',
          type: 'documentreference_attachment',
          connectionId: 'conn-2',
        }),
        attachment,
      ]);

      const result = await findAttachment(
        db,
        'user-a',
        'conn-1',
        'https://fhir.example.org/Binary/1',
      );

      expect(result).toEqual(attachment);
    });

    it('returns null when no attachment has the id', async () => {
      const result = await findAttachment(
        db,
        'user-a',
        'conn-1',
        'https://fhir.example.org/Binary/1',
      );

      expect(result).toBeNull();
    });
  });
});
