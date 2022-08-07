import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { OnPatient } from '../services/OnPatient';
import { usePouchDb } from '../components/PouchDbProvider';
import { ConnectionCard } from '../app/ConnectionCard';
import { isElectron } from '../utils/electron';
import { GenericBanner } from '../app/GenericBanner';

const SettingsTab: React.FC = () => {
  const db = usePouchDb(),
    [list, setList] = useState<PouchDB.Find.FindResponse<ConnectionDocument>>(),
    loginUrl = OnPatient.getLoginUrl(),
    getList = useCallback(() => {
      db.find({
        selector: { type: 'connection' },
      }).then((list) => {
        console.log(list);
        setList(list as PouchDB.Find.FindResponse<ConnectionDocument>);
      });
    }, [db]),
    fetchData = useCallback(
      async (
        connectionDocument: ConnectionDocument,
        db: PouchDB.Database<{}>
      ) => await OnPatient.syncAllRecords(connectionDocument, db),
      []
    ),
    refreshToken = useCallback(
      (
        refToken: string,
        lastDoc: PouchDB.Core.ExistingDocument<ConnectionDocument>
      ) => {
        OnPatient.getAccessTokenFromRefreshToken(refToken)
          .then((codeRes) => {
            const dbentry: ConnectionDocument = {
              ...lastDoc,
              ...codeRes,
            };
            db.put(dbentry)
              .then(() => getList())
              .catch((e) => {
                alert(`OAuth rejected ${e}`);
              });
          })
          .catch((err) => {
            alert(`OAuth rejected ${err}`);
          });
      },
      [db, getList]
    );

  useEffect(() => {
    getList();
  }, [getList]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <GenericBanner text="Settings" />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="w-full box-border	flex justify-center align-middle">
          <p>TODO</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
