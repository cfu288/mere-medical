import {
  IonContent,
  IonHeader,
  IonPage,
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

const ConnectionTab: React.FC = () => {
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
                alert(`Unable to save new connection: ${e}`);
                console.error(e);
              });
          })
          .catch((err) => {
            alert(`OAuth rejected ${err}`);
            console.error(err);
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
          <GenericBanner text="ADD NEW RECORD" />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <ul className="grid grid-cols-1 gap-4 p-4">
          {list?.docs.map((item) => (
            <ConnectionCard
              key={item._id}
              item={item}
              getList={getList}
              refreshToken={refreshToken}
              fetchData={fetchData}
            />
          ))}
        </ul>
        <div className="w-full box-border	flex justify-center align-middle">
          <IonButton
            className="m-4 w-11/12 h-12"
            href={isElectron() ? '' : loginUrl}
            onClick={() => {
              if (isElectron()) {
                // Renderer process
              }
            }}
          >
            <p className="font-bold">Log in to OnPatient</p>
          </IonButton>
        </div>
        <div className="w-full box-border	flex justify-center align-middle">
          <IonButton
            className="m-4 w-11/12 h-12"
            href={isElectron() ? '' : loginUrl}
            onClick={() => {
              if (isElectron()) {
                // Renderer process
              }
            }}
          >
            <p className="font-bold">Log in to Epic</p>
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ConnectionTab;
