import { useCallback, useEffect, useState } from 'react';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import * as OnPatient from '../services/OnPatient';
import { useRxDb } from '../components/providers/RxDbProvider';
import { RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { ConnectionCard } from '../components/connection/ConnectionCard';
import { EpicLocalStorageKeys, getLoginUrl } from '../services/Epic';
import {
  CernerLocalStorageKeys,
  getLoginUrl as getCernerLoginUrl,
} from '../services/Cerner';
import { AppPage } from '../components/AppPage';
import { EpicSelectModal } from '../components/connection/EpicSelectModal';
import { useUserPreferences } from '../components/providers/UserPreferencesProvider';
import { Routes } from '../Routes';
import { Link } from 'react-router-dom';
import { useUser } from '../components/providers/UserProvider';
import { CernerSelectModal } from '../components/connection/CernerSelectModal';

function useConnectionCards() {
  const db = useRxDb(),
    user = useUser(),
    [list, setList] = useState<RxDocument<ConnectionDocument>[]>();

  useEffect(() => {
    const sub = db.connection_documents
      .find({
        selector: {
          user_id: user.id,
        },
      })
      .$.subscribe((list) =>
        setList(list as unknown as RxDocument<ConnectionDocument>[])
      );
    return () => sub.unsubscribe();
  }, [db.connection_documents, user.id]);

  return list;
}

const ConnectionTab: React.FC = () => {
  const list = useConnectionCards(),
    [epicOpen, setEpicOpen] = useState(false),
    [cernerOpen, setCernerOpen] = useState(false),
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
    setTenantCernerUrl = useCallback(
      (
        base: string & Location,
        auth: string & Location,
        token: string & Location,
        name: string,
        id: string
      ) => {
        localStorage.setItem(CernerLocalStorageKeys.CERNER_BASE_URL, base);
        localStorage.setItem(CernerLocalStorageKeys.CERNER_AUTH_URL, auth);
        localStorage.setItem(CernerLocalStorageKeys.CERNER_TOKEN_URL, token);
        localStorage.setItem(CernerLocalStorageKeys.CERNER_NAME, name);
        localStorage.setItem(CernerLocalStorageKeys.CERNER_ID, id);
      },
      []
    ),
    handleToggleEpicPanel = useCallback(
      (loc: string & Location, name: string, id: string) => {
        setTenantEpicUrl(loc, name, id);
        setEpicOpen((x) => !x);
        window.location = getLoginUrl(loc, id === 'sandbox');
      },
      [setTenantEpicUrl]
    ),
    handleToggleCernerPanel = useCallback(
      (
        base: string & Location,
        auth: string & Location,
        token: string & Location,
        name: string,
        id: string
      ) => {
        setTenantCernerUrl(base, auth, token, name, id);
        setCernerOpen((x) => !x);
        window.location = getCernerLoginUrl(base, auth);
      },
      [setTenantCernerUrl]
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
              className="bg-primary hover:bg-primary-600 mb-4 w-full rounded-lg p-4 text-center text-white"
            >
              <button>
                <p className="font-bold">Log in to OnPatient</p>
              </button>
            </a>
          ) : (
            <div className="mb-4 flex w-full flex-col items-center">
              <button
                disabled
                className="w-full rounded-lg p-4 text-center text-white disabled:bg-gray-300"
              >
                <p className="font-bold">Log in to OnPatient</p>
              </button>
              <p className="pt-2">
                To log in with OnPatient, go to{' '}
                <Link
                  className="text-primary hover:text-primary-500 w-full text-center underline"
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
            className="bg-primary hover:bg-primary-600 w-full rounded-lg p-4 text-white"
            onClick={() => setEpicOpen((x) => !x)}
          >
            <p className="font-bold">Log in to Epic MyChart</p>
          </button>
        </div>
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          {/* <a
            className="w-full"
            href={getCernerLoginUrl('https://fhir-myrecord.cerner.com')}
          > */}
          <button
            className="bg-primary hover:bg-primary-600 w-full rounded-lg p-4 text-white"
            onClick={() => {
              setCernerOpen((x) => !x);
            }}
          >
            <p className="font-bold">Log in to Cerner</p>
          </button>
          {/* </a> */}
        </div>
      </div>
      <EpicSelectModal
        open={epicOpen}
        setOpen={setEpicOpen}
        onClick={handleToggleEpicPanel}
      />
      <CernerSelectModal
        open={cernerOpen}
        setOpen={setCernerOpen}
        onClick={handleToggleCernerPanel}
      />
    </AppPage>
  );
};

export default ConnectionTab;

export interface SelectOption {
  id: string;
  name: string;
  baseUrl: string & Location;
  authUrl: string & Location;
  tokenUrl: string & Location;
}
