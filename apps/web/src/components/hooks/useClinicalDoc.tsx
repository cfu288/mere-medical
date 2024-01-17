import { useCallback, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useRxDb } from '../providers/RxDbProvider';
import { DatabaseCollections } from '../providers/DatabaseCollections';

/**
 * This hook is used to get the clinical document given a metadata.id
 * @param id This is the metadata.id of the clinical document - usually the full url
 * @returns The clinical document
 */
export function useClinicalDoc(id?: string) {
  const db = useRxDb(),
    [conn, setConn] = useState<RxDocument<ClinicalDocument>>(),
    getList = useCallback(() => {
      if (id) {
        getClinicalDocWithMetaId(id, db).then((list) => {
          setConn(list as unknown as RxDocument<ClinicalDocument>);
        });
      }
    }, [db, id]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conn;
}

/**
 * Fetch a clinical document with the original document url
 * @param id metadata.id, aka the foll url of the original document
 * @param db
 * @returns
 */
async function getClinicalDocWithMetaId(
  id: string,
  db: RxDatabase<DatabaseCollections>,
) {
  if (!id) {
    return [];
  }
  return db.clinical_documents
    .findOne({
      selector: {
        'metadata.id': id,
      },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ClinicalDocument>);
}
