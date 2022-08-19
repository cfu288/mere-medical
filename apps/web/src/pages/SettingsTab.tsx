import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import { BundleEntry, FhirResource, Patient } from 'fhir/r2';
import { useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { EmptyRecordsPlaceholder } from '../models/EmptyRecordsPlaceholder';
import { EmptyUserPlaceholder } from '../models/EmptyUserPlaceholder';
import { UserDocument } from '../models/UserDocument';

function fetchUsers(db: RxDatabase<DatabaseCollections>) {
  return db.user_documents
    .find({})
    .exec()
    .then((list) => {
      const lst = list as unknown as RxDocument<UserDocument>[];

      return lst;
    });
}

const SettingsTab: React.FC = () => {
  const db = useRxDb(),
    [pts, setPts] = useState<UserDocument[]>([]);

  useEffect(() => {
    fetchUsers(db).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      setPts(res);
    });
  }, [db]);

  return (
    <IonPage>
      <IonHeader>
        <GenericBanner text="Settings" />
      </IonHeader>
      <IonContent fullscreen>
        <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyUserPlaceholder />
        </div>
        <div className="w-full box-border	flex justify-center align-middle">
          {pts.map((item) => (
            <div>
              <p>{item.first_name}</p>
              <p>{item.last_name}</p>
            </div>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
