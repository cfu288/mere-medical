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
import { isElectron } from '../utils/electron';
import { RxDatabase, RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { ConnectionCard } from '../components/ConnectionCard';

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
              ...lastDoc.toJSON(),
              ...codeRes,
            };
            db.connection_documents
              .upsert(dbentry)
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
        <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 gap-x-4">
          <ul className="grid grid-cols-1 py-8">
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
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ConnectionTab;
