import { memo, useCallback, useEffect, useState } from 'react';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocumentType';
import * as OnPatient from '../services/OnPatient';
import { useRxDb } from '../components/providers/RxDbProvider';
import { RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { ConnectionCard } from '../components/connection/ConnectionCard';
import { EpicLocalStorageKeys, getLoginUrl } from '../services/Epic';
import { AppPage } from '../components/AppPage';
import { EpicSelectModal } from '../components/connection/EpicSelectModal';
import { EpicSelectModelResultItem } from '../components/connection/EpicSelectModelResultItem';
import { useUserPreferences } from '../components/providers/UserPreferencesProvider';
import { Routes } from '../Routes';
import { Link } from 'react-router-dom';

function useConnectionCards() {
  const db = useRxDb(),
    [list, setList] = useState<RxDocument<ConnectionDocument>[]>();

  useEffect(() => {
    const sub = db.connection_documents
      .find({
        selector: {},
      })
      .$.subscribe((list) =>
        setList(list as unknown as RxDocument<ConnectionDocument>[])
      );
    return () => sub.unsubscribe();
  }, [db.connection_documents]);

  return list;
}

const ConnectionTab: React.FC = () => {
  const list = useConnectionCards(),
    [open, setOpen] = useState(false),
    userPreferences = useUserPreferences(),
    onpatientLoginUrl = OnPatient.getLoginUrl(),
    setTenantEpicUrl = useCallback(
      (s: string & Location, name: string, id: string) => {
        localStorage.setItem(EpicLocalStorageKeys.EPIC_URL, s);
        localStorage.setItem(EpicLocalStorageKeys.EPIC_NAME, name);
        localStorage.setItem(EpicLocalStorageKeys.EPIC_ID, id);
      },
      []
    ),
    handleToggleEpicPanel = useCallback(
      (loc: string & Location, name: string, id: string) => {
        setTenantEpicUrl(loc, name, id);
        setOpen((x) => !x);
        window.location = getLoginUrl(loc);
      },
      [setTenantEpicUrl]
    );

  return (
    <AppPage banner={<GenericBanner text="Add Connections" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
        <div className="py-6 text-xl font-extrabold">
          Connect to Patient Portal
        </div>
        <div className="text-sm font-medium text-gray-500">
          Connect to a patient portal to automatic download your most recent
          data.
        </div>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 sm:px-6 lg:px-8">
        <ul className="grid grid-cols-1 py-8">
          {list?.map((item) => (
            <ConnectionCard
              key={item.id}
              item={item}
              baseUrl={item.get('location')}
            />
          ))}
        </ul>
        <div className="box-border flex	w-full justify-center align-middle">
          {userPreferences?.use_proxy ? (
            <a
              href={onpatientLoginUrl}
              className="bg-primary mb-4 w-full rounded-lg p-4 text-center text-white"
            >
              <button>
                <p className="font-bold">Log in to OnPatient</p>
              </button>
            </a>
          ) : (
            <div className="mb-4 flex w-full flex-col">
              <button
                disabled
                className="w-full rounded-lg p-4 text-center text-white disabled:bg-gray-300"
              >
                <p className="font-bold">Log in to OnPatient</p>
              </button>
              <p>
                To log in with OnPatient, go to{' '}
                <Link
                  className="text-primary hover:text-primary-500 underline"
                  to={`${Routes.Settings}#use_proxy`}
                >
                  the settings page
                </Link>{' '}
                and enable the <code>use proxy</code> setting.
              </p>
            </div>
          )}
        </div>
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          <button
            className="bg-primary w-full rounded-lg p-4 text-white"
            onClick={() => setOpen((x) => !x)}
          >
            <p className="font-bold">Log in to Epic MyChart</p>
          </button>
        </div>
      </div>
      <EpicSelectModal
        open={open}
        setOpen={setOpen}
        onClick={handleToggleEpicPanel}
      />
    </AppPage>
  );
};

export default ConnectionTab;

export interface SelectOption {
  id: string;
  name: string;
  url: string & Location;
}

export const MemoizedResultItem = memo(EpicSelectModelResultItem);
