import { IonContent, IonHeader, IonPage } from '@ionic/react';
import { useEffect, useState } from 'react';
import { RxDatabase, RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
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
    [users, setUsers] = useState<UserDocument[]>([]);

  useEffect(() => {
    fetchUsers(db).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      setUsers(res);
    });
  }, [db]);

  return (
    <IonPage>
      <IonHeader>
        <GenericBanner text="Settings" />
      </IonHeader>
      <IonContent fullscreen>
        {users && users.length === 0 && (
          <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <EmptyUserPlaceholder />
          </div>
        )}
        <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 gap-x-4">
          <div className="font-extrabold text-xl py-6">About Me</div>
        </div>
        <div className="flex flex-col max-w-sm mx-auto mt-2 px-4 sm:px-6 lg:px-8">
          {users.map((item) => (
            <li
              key={item.email || item._id}
              className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-lg bg-white text-center border border-gray-200"
            >
              <div className="flex flex-1 flex-col p-8">
                {/* <img
                    className="mx-auto h-32 w-32 flex-shrink-0 rounded-full"
                    // src={item.imageUrl}
                    alt=""
                  /> */}
                <div className="mx-auto h-32 w-32 flex-shrink-0 rounded-full border border-black">
                  <svg
                    className="h-full w-full text-gray-300 rounded-full"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h2 className="mt-6 text-md font-medium text-gray-600 text-start">
                  Name
                </h2>
                <p className="mt-2 text-md font-medium text-gray-900 text-start">
                  {item.first_name} {item.last_name}
                </p>
                <h2 className="mt-6 text-md font-medium text-gray-600 text-start">
                  Birthday
                </h2>
                <p className="mt-2 text-md font-medium text-gray-900 text-start">
                  {item.birthday}
                </p>
                <h2 className="mt-6 text-md font-medium text-gray-600 text-start">
                  Email
                </h2>
                <p className="mt-2 text-md font-medium text-gray-900 text-start">
                  {item.email}
                </p>
              </div>
            </li>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
