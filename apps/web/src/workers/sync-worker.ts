/* eslint-disable no-restricted-globals */
import { initRxDb } from '../components/providers/RxDbProvider';
import { SyncActions } from '../services/SyncWorkerDispatch';
import * as Cerner from '../services/Cerner';
import * as Epic from '../services/Epic';
import * as OnPatient from '../services/OnPatient';
import {
  CernerConnectionDocument,
  ConnectionDocument,
  EpicConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';

(async () => {
  debugger;
  const db = await initRxDb();

  self.onmessage = async ({
    data,
  }: {
    data: {
      action: SyncActions;
      data: {
        baseUrl: string;
        connectionDocumentId: string;
        useProxy?: boolean;
      };
    };
  }) => {
    const cd = (
      await db.connection_documents.findByIds([data.data.connectionDocumentId])
    ).get(data.data.connectionDocumentId);

    if (cd && cd?.get('is_syncing') === false) {
      await cd.update({
        $set: {
          is_syncing: true,
        },
      });

      switch (data.action) {
        case 'sync': {
          try {
            switch (cd.get('source')) {
              case 'onpatient': {
                await OnPatient.syncAllRecords(
                  cd.toMutableJSON() as ConnectionDocument,
                  db
                );
                break;
              }
              case 'cerner': {
                await Cerner.syncAllRecords(
                  data.data.baseUrl,
                  cd.toMutableJSON() as CernerConnectionDocument,
                  db
                );
                break;
              }
              case 'epic': {
                await Epic.syncAllRecords(
                  data.data.baseUrl,
                  cd?.toMutableJSON() as EpicConnectionDocument,
                  db,
                  data.data.useProxy
                );
                break;
              }
              default: {
                throw Error(`Cannot sync unknown source: ${cd.source}`);
              }
            }
          } catch (e) {
            self.postMessage({ error: `Errors with sync: ${e}` });
          }
          break;
        }
      }

      await cd?.update({
        $set: {
          is_syncing: false,
          last_refreshed: new Date().toISOString(),
        },
      });
    }
  };
})()
  .then(() => {
    console.log('Sync worker initialized');
  })
  .catch((e) => {
    console.error('Could not initialize sync worker');
    console.error(e);
  });
