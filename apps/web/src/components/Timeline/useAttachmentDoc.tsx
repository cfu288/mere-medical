import { useCallback, useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { ClinicalDocument } from '../../models/ClinicalDocument';
import { DatabaseCollections, useRxDb } from '../RxDbProvider';

export function useClinicalDoc(id?: string) {
  const db = useRxDb(),
    [conn, setConn] = useState<RxDocument<ClinicalDocument>>(),
    getList = useCallback(() => {
      if (id) {
        getClinicalAttachment(id, db).then((list) => {
          setConn(list as unknown as RxDocument<ClinicalDocument>);
        });
      }
    }, [db, id]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conn;
}

async function getClinicalAttachment(
  id: string,
  db: RxDatabase<DatabaseCollections, any, any>
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
