import { IonContent, IonHeader, IonPage, IonButton } from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { OnPatient } from '../services/OnPatient';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { RxDatabase, RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { ConnectionCard } from '../components/ConnectionCard';

async function getConnectionCards(
  db: RxDatabase<DatabaseCollections, any, any>
) {
  return db.connection_documents
    .find({
      selector: {},
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>[]);
}

const ConnectionTab: React.FC = () => {
  const db = useRxDb(),
    [list, setList] = useState<RxDocument<ConnectionDocument>[]>(),
    loginUrl = OnPatient.getLoginUrl(),
    getList = useCallback(() => {
      getConnectionCards(db).then((list) => {
        setList(list as unknown as RxDocument<ConnectionDocument>[]);
      });
    }, [db]),
    fetchData = useCallback(
      async (
        connectionDocument: RxDocument<ConnectionDocument>,
        db: RxDatabase<DatabaseCollections>
      ) => await OnPatient.syncAllRecords(connectionDocument, db),
      []
    );

  useEffect(() => {
    getList();
  }, [getList]);

  return (
    <IonPage>
      <IonHeader>
        <GenericBanner text="Add Connections" />
      </IonHeader>
      <IonContent fullscreen>
        <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 gap-x-4">
          <div className="font-extrabold text-xl py-6">
            Connect to Patient Portal
          </div>
          <div className="text-sm font-medium text-gray-500">
            Connect to a patient portal to automatic download your most recent
            data.
          </div>
        </div>
        <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 gap-x-4">
          <ul className="grid grid-cols-1 py-8">
            {list?.map((item) => (
              <ConnectionCard
                key={item._id}
                item={item}
                fetchData={fetchData}
              />
            ))}
          </ul>
          <div className="w-full box-border	flex justify-center align-middle">
            <IonButton className="m-4 w-11/12 h-12" href={loginUrl}>
              <p className="font-bold">Log in to OnPatient</p>
            </IonButton>
          </div>
          <div className="w-full box-border	flex justify-center align-middle">
            <IonButton disabled className="m-4 w-11/12 h-12" href={loginUrl}>
              <p className="font-bold">Log in to Epic</p>
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ConnectionTab;
