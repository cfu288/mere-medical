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
import { AddConnectionBanner } from './AddConnectionBanner';
import { ConnectionCard } from './ConnectionCard';

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
          <AddConnectionBanner />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Connect your data</IonTitle>
          </IonToolbar>
        </IonHeader>
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
          <IonButton className="m-4 w-11/12 h-12" href={loginUrl}>
            <p className="font-bold">Log in to OnPatient</p>
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ConnectionTab;
