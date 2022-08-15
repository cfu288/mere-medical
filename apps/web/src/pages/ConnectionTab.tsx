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
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { ConnectionCard } from '../app/ConnectionCard';
import { isElectron } from '../utils/electron';
import { GenericBanner } from '../app/GenericBanner';
import { RxDatabase, RxDocument } from 'rxdb';

const ConnectionTab: React.FC = () => {
  const db = useRxDb(),
    [list, setList] = useState<RxDocument<ConnectionDocument>[]>(),
    loginUrl = OnPatient.getLoginUrl(),
    getList = useCallback(() => {
      db.connection_documents
        .find({
          selector: {},
        })
        .exec()
        .then((list) => {
          console.log('List');
          console.log(list);
          setList(list as unknown as RxDocument<ConnectionDocument>[]);
        });
    }, [db]),
    fetchData = useCallback(
      async (
        connectionDocument: RxDocument<ConnectionDocument>,
        db: RxDatabase<DatabaseCollections>
      ) => await OnPatient.syncAllRecords(connectionDocument, db),
      []
    ),
    refreshToken = useCallback(
      (refToken: string, lastDoc: RxDocument<ConnectionDocument>) => {
        OnPatient.getAccessTokenFromRefreshToken(refToken)
          .then((codeRes) => {
            const dbentry: ConnectionDocument = {
              ...lastDoc,
              ...codeRes,
            };
            db.connection_documents
              .insert(dbentry)
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
          {list?.map((item) => (
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
