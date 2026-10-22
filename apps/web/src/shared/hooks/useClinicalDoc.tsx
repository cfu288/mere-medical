import { useCallback, useEffect, useState } from 'react';
import { ClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { useRxDb } from '../../app/providers/RxDbProvider';
import { useUser } from '../../app/providers/UserProvider';
import { findAttachment } from '../../repositories/ClinicalDocumentRepository';

/**
 * This hook is used to get the clinical document given a metadata.id
 * @param connectionId The connection the document came from
 * @param id This is the metadata.id of the clinical document - usually the full url
 * @returns The clinical document
 */
export function useClinicalDoc(connectionId: string, id?: string) {
  const db = useRxDb(),
    user = useUser(),
    [conn, setConn] = useState<ClinicalDocument | null>(),
    getList = useCallback(() => {
      if (id) {
        findAttachment(db, user.id, connectionId, id).then(setConn);
      }
    }, [db, user.id, connectionId, id]);

  useEffect(() => {
    getList();
  }, [getList]);

  return conn;
}
