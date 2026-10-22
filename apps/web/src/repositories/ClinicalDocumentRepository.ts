import { MangoQuerySelector, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
  CreateClinicalDocument,
} from '../models/clinical-document/ClinicalDocument.type';

export async function deleteDocumentsByConnectionId(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        connection_record_id: connectionId,
      },
    })
    .remove();
}

export async function bulkUpsertDocuments<T>(
  db: RxDatabase<DatabaseCollections>,
  documents: CreateClinicalDocument<T>[],
): Promise<void> {
  await db.clinical_documents.bulkUpsert(
    documents as unknown as ClinicalDocument[],
  );
}

export async function createDocument<T>(
  db: RxDatabase<DatabaseCollections>,
  document: CreateClinicalDocument<T>,
): Promise<void> {
  await db.clinical_documents.insert(
    document as unknown as ClinicalDocument<T>,
  );
}

export async function findDocumentsByResourceType<T>(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  resourceType: ClinicalDocumentResourceType,
): Promise<ClinicalDocument<T>[]> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'data_record.resource_type': { $eq: resourceType },
        connection_record_id: connectionId,
      },
    })
    .exec();

  return docs.map(
    (doc) => doc.toMutableJSON() as unknown as ClinicalDocument<T>,
  );
}

export async function documentExistsByMetadataId(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  metadataId: string,
): Promise<boolean> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        $and: [
          { user_id: userId },
          { 'metadata.id': metadataId },
          { connection_record_id: connectionId },
        ],
      },
    })
    .exec();

  return docs.length > 0;
}

const TIMELINE_EXCLUDED_TYPES: ClinicalDocumentResourceType[] = [
  'patient',
  'careplan',
  'documentreference_attachment',
  'provenance',
];

/**
 * Reads one page of the timeline records, newest first. These are the user's
 * dated records except patients, care plans, note attachments and
 * provenance. The timeline and its search call it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`. The user who owns the records.
 * @param page `{ skip: number; limit: number; search?: string }`. `search`
 * matches anywhere in the display name, ignoring case. Blank search text reads
 * as no search.
 * @returns `Promise<ClinicalDocument[]>`.
 *
 * @example
 * const firstPage = await findTimelineRecords(db, user.id, { skip: 0, limit: 50, search: 'glucose' });
 */
export async function findTimelineRecords(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  page: { skip: number; limit: number; search?: string },
): Promise<ClinicalDocument[]> {
  const search = page.search?.trim();
  const selector: MangoQuerySelector<ClinicalDocument> = {
    user_id: userId,
    'data_record.resource_type': { $nin: TIMELINE_EXCLUDED_TYPES },
    'metadata.date': { $nin: [null, undefined, ''] },
    ...(search
      ? {
          'metadata.display_name': {
            $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            $options: 'si',
          },
        }
      : {}),
  };
  const docs = await db.clinical_documents
    .find({ selector, sort: [{ 'metadata.date': 'desc' }] })
    .skip(page.skip)
    .limit(page.limit)
    .exec();
  return docs.map((doc) => doc.toMutableJSON() as ClinicalDocument);
}

/**
 * Reads every record of the user that carries any of the LOINC codes. The lab
 * history of a result calls it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param loincCodes `string[]`. No codes returns no records.
 * @returns `Promise<ClinicalDocument[]>`.
 *
 * @example
 * const glucoseResults = await findRecordsByLoincCodes(db, user.id, ['2345-7']);
 */
export async function findRecordsByLoincCodes(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  loincCodes: string[],
): Promise<ClinicalDocument[]> {
  if (loincCodes.length === 0) {
    return [];
  }
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'metadata.loinc_coding': { $in: loincCodes },
      },
    })
    .exec();
  return docs.map((doc) => doc.toMutableJSON() as ClinicalDocument);
}

/**
 * Reads the records of one connection of the user whose `metadata.id` is any
 * of the ids. A diagnostic report reads its results with it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param connectionId `string`. The connection the records came from.
 * @param metadataIds `string[]`.
 * @returns `Promise<ClinicalDocument[]>`.
 *
 * @example
 * const results = await findRecordsByMetadataIds(db, user.id, report.connection_record_id, ['https://fhir.example.org/Observation/1']);
 */
export async function findRecordsByMetadataIds(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  metadataIds: string[],
): Promise<ClinicalDocument[]> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        connection_record_id: connectionId,
        'metadata.id': { $in: metadataIds },
      },
    })
    .exec();
  return docs.map((doc) => doc.toMutableJSON() as ClinicalDocument);
}

/**
 * Reads the user's records of the given types that have a date, newest first.
 * The summary page cards call it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param resourceTypes `ClinicalDocumentResourceType[]`.
 * @returns `Promise<ClinicalDocument[]>`.
 *
 * @example
 * const medications = await findDatedRecordsByType(db, user.id, ['medicationstatement', 'medicationrequest']);
 */
export async function findDatedRecordsByType(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  resourceTypes: ClinicalDocumentResourceType[],
): Promise<ClinicalDocument[]> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'data_record.resource_type': { $in: resourceTypes },
        'metadata.date': { $nin: [null, undefined, ''] },
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec();
  return docs.map((doc) => doc.toMutableJSON() as ClinicalDocument);
}

/**
 * Reads all the user's records of the given types, dated or not, newest first.
 * The settings page reads patient records with it, and the summary page reads
 * care plans.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param resourceTypes `ClinicalDocumentResourceType[]`.
 * @returns `Promise<ClinicalDocument[]>`.
 *
 * @example
 * const patients = await findRecordsByType(db, user.id, ['patient']);
 */
export async function findRecordsByType(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  resourceTypes: ClinicalDocumentResourceType[],
): Promise<ClinicalDocument[]> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'data_record.resource_type': { $in: resourceTypes },
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec();
  return docs.map((doc) => doc.toMutableJSON() as ClinicalDocument);
}

/**
 * Reads the user's records with the given ids, in the order of the ids. It
 * skips ids that match no record of the user. The summary page reads pinned labs
 * with it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param ids `string[]`. Stored record ids.
 * @returns `Promise<ClinicalDocument[]>`.
 *
 * @example
 * const pinned = await findRecordsByIds(db, user.id, preferences.pinned_labs);
 */
export async function findRecordsByIds(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  ids: string[],
): Promise<ClinicalDocument[]> {
  const found = await db.clinical_documents.findByIds(ids);
  return ids.flatMap((id) => {
    const doc = found.get(id);
    return doc && doc.user_id === userId
      ? [doc.toMutableJSON() as ClinicalDocument]
      : [];
  });
}

/**
 * Reads the stored content of a note, which sync saves as a
 * `documentreference_attachment` record under the attachment URL. The note
 * viewer and the timeline note preview call it.
 *
 * @param db `RxDatabase<DatabaseCollections>`.
 * @param userId `string`.
 * @param connectionId `string`. The connection of the note.
 * @param metadataId `string`. The attachment URL, or
 * `{note metadata.id}/attachment` for content sent inside the note.
 * @returns `Promise<ClinicalDocument | null>`.
 *
 * @example
 * const attachment = await findAttachment(db, user.id, note.connection_record_id, 'https://fhir.example.org/Binary/1');
 */
export async function findAttachment(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
  metadataId: string,
): Promise<ClinicalDocument | null> {
  const doc = await db.clinical_documents
    .findOne({
      selector: {
        user_id: userId,
        connection_record_id: connectionId,
        'metadata.id': metadataId,
      },
    })
    .exec();
  return doc ? (doc.toMutableJSON() as ClinicalDocument) : null;
}
