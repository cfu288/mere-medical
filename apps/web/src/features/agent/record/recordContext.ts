import { BundleEntry, FhirResource } from 'fhir/r2';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import {
  findAllDocuments,
  watchDocumentChanges,
} from '../../../repositories/ClinicalDocumentRepository';
import { findAllConnections } from '../../../repositories/ConnectionRepository';
import { NoteRecord } from './notes/noteRecord';
import { toNoteRecords } from './notes/noteStore';
import { buildLabIndex, LabIndexEntry } from './sections/labs';
import { buildRecordIndex, RecordIndex } from './sections/recordIndex';
import { ClinicalDoc, docsByType } from './types';

/** The indexes the agent's tools read: labs, other record entries and notes. */
export type RecordContext = {
  labs: LabIndexEntry[];
  records: RecordIndex;
  notes: NoteRecord[];
};

export type ClinicalDocStore = {
  docs: ClinicalDoc[];
  connectionLocations: Map<string, string>;
};

export async function loadClinicalDocs(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<ClinicalDocStore> {
  const [docs, connections] = await Promise.all([
    findAllDocuments<BundleEntry<FhirResource>>(db, userId),
    findAllConnections(db, userId),
  ]);
  const connectionLocations = new Map<string, string>();
  for (const connection of connections) {
    if (typeof connection.location === 'string') {
      connectionLocations.set(connection.id, connection.location);
    }
  }
  return { docs, connectionLocations };
}

export function buildRecordContext(store: ClinicalDocStore): RecordContext {
  const byType = docsByType(store.docs);
  const notes = toNoteRecords(byType);
  return {
    labs: buildLabIndex(byType, store.connectionLocations),
    records: buildRecordIndex(byType, store.connectionLocations, notes),
    notes,
  };
}

export type RecordContextCache = {
  get: () => Promise<RecordContext>;
  dispose: () => void;
};

/**
 * Builds the user's record context on first use and keeps it until one of the
 * user's records changes. A build that fails is not kept.
 */
export function createRecordContextCache(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): RecordContextCache {
  // shortcut: any change rebuilds the whole context; make it incremental if a rebuild is slow on large records
  let cached: Promise<RecordContext> | undefined;
  const subscription = watchDocumentChanges(db, userId).subscribe(() => {
    cached = undefined;
  });
  return {
    get: () => {
      if (!cached) {
        const building = loadClinicalDocs(db, userId).then(buildRecordContext);
        cached = building;
        building.catch(() => {
          if (cached === building) {
            cached = undefined;
          }
        });
      }
      return cached;
    },
    dispose: () => subscription.unsubscribe(),
  };
}
