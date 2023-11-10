import { useCallback, useState } from 'react';
import * as OnPatient from '../services/OnPatient';
import { GenericBanner } from '../components/GenericBanner';
import { ConnectionCard } from '../components/connection/ConnectionCard';
import {
  EpicLocalStorageKeys,
  getLoginUrl as getEpicLoginUrl,
} from '../services/Epic';
import {
  CernerLocalStorageKeys,
  getLoginUrl as getCernerLoginUrl,
} from '../services/Cerner';

import { AppPage } from '../components/AppPage';
import { EpicSelectModal } from '../components/connection/EpicSelectModal';
import { useUserPreferences } from '../components/providers/UserPreferencesProvider';
import { Routes } from '../Routes';
import { Link } from 'react-router-dom';
import { CernerSelectModal } from '../components/connection/CernerSelectModal';
import { VeradigmSelectModal } from '../components/connection/VeradigmSelectModal';
import {
  VeradigmLocalStorageKeys,
  getLoginUrl as getVeradigmLoginUrl,
} from '../services/Veradigm';
import { useConnectionCards } from '../components/hooks/useConnectionCards';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import { RxDocument } from 'rxdb';
import React from 'react';

export function getLoginUrlBySource(
  item: RxDocument<ConnectionDocument>
): string & Location {
  switch (item.get('source')) {
    case 'epic': {
      return getEpicLoginUrl(
        item.get('location'),
        item.get('tenant_id') === 'sandbox' ||
          item.get('tenant_id') === '7c3b7890-360d-4a60-9ae1-ca7d10d5b354'
      );
    }
    case 'cerner': {
      debugger;
      console.log(item.toJSON());
      return getCernerLoginUrl(item.get('location'), item.get('auth_uri'));
    }
    case 'veradigm': {
      return getVeradigmLoginUrl(item.get('location'), item.get('auth_uri'));
    }
    case 'onpatient': {
      return OnPatient.getLoginUrl();
    }
    default: {
      return '' as string & Location;
    }
  }
}

export function setTenantUrlBySource(
  item: RxDocument<ConnectionDocument>
): void {
  switch (item.get('source')) {
    case 'epic': {
      setTenantEpicUrl(
        item.get('location'),
        item.get('name'),
        item.get('tenant_id')
      );
      break;
    }
    case 'cerner': {
      setTenantCernerUrl(
        item.get('location'),
        item.get('auth_uri'),
        item.get('auth_uri'),
        item.get('name'),
        item.get('id')
      );
      break;
    }
    case 'veradigm': {
      setTenantVeradigmUrl(
        item.get('location'),
        item.get('auth_uri'),
        item.get('token_uri'),
        item.get('name'),
        item.get('id')
      );
      break;
    }
    default: {
      break;
    }
  }
}

function setTenantEpicUrl(
  s: string & Location,
  name: string,
  id: string
): void {
  localStorage.setItem(EpicLocalStorageKeys.EPIC_URL, s);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_NAME, name);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_ID, id);
}

function setTenantCernerUrl(
  base: string & Location,
  auth: string & Location,
  token: string & Location,
  name: string,
  id: string
): void {
  localStorage.setItem(CernerLocalStorageKeys.CERNER_BASE_URL, base);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_AUTH_URL, auth);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_TOKEN_URL, token);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_NAME, name);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_ID, id);
}

function setTenantVeradigmUrl(
  base: string & Location,
  auth: string & Location,
  token: string & Location,
  name: string,
  id: string
): void {
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_BASE_URL, base);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_AUTH_URL, auth);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_TOKEN_URL, token);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_NAME, name);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_ID, id);
}

const ConnectionTab: React.FC = () => {
  const list = useConnectionCards(),
    [epicOpen, setEpicOpen] = useState(false),
    [cernerOpen, setCernerOpen] = useState(false),
    [veradigmOpen, setVeradigmOpen] = useState(false),
    userPreferences = useUserPreferences(),
    onpatientLoginUrl = OnPatient.getLoginUrl(),
    handleToggleEpicPanel = useCallback(
      (loc: string & Location, name: string, id: string) => {
        setTenantEpicUrl(loc, name, id);
        setEpicOpen((x) => !x);
        window.location = getEpicLoginUrl(loc, id === 'sandbox');
      },
      []
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
      []
    ),
    handleToggleVeradigmPanel = useCallback(
      (
        base: string & Location,
        auth: string & Location,
        token: string & Location,
        name: string,
        id: string
      ) => {
        setTenantVeradigmUrl(base, auth, token, name, id);
        setVeradigmOpen((x) => !x);
        window.location = getVeradigmLoginUrl(base, auth);
      },
      []
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
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          <button
            className="bg-primary hover:bg-primary-600 active:bg-primary-700 w-full rounded-lg p-4 text-white duration-75 active:scale-[98%]"
            onClick={() => setEpicOpen((x) => !x)}
          >
            <p className="font-bold">Log in to Epic MyChart</p>
          </button>
        </div>
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          <button
            className="bg-primary hover:bg-primary-600 active:bg-primary-700 w-full rounded-lg p-4 text-white duration-75 active:scale-[98%]"
            onClick={() => {
              setCernerOpen((x) => !x);
            }}
          >
            <p className="font-bold">Log in to Cerner</p>
          </button>
        </div>
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          <button
            className="bg-primary hover:bg-primary-600 active:bg-primary-700 w-full rounded-lg p-4 text-white duration-75 active:scale-[98%]"
            onClick={() => {
              setVeradigmOpen((x) => !x);
            }}
          >
            <p className="font-bold">Log in to Allscripts Connect</p>
          </button>
        </div>
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          {userPreferences?.use_proxy ? (
            <a
              href={onpatientLoginUrl}
              className=" bg-primary hover:bg-primary-600 active:bg-primary-700 w-full rounded-lg p-4 text-center text-white duration-75 active:scale-[98%]"
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
      <VeradigmSelectModal
        open={veradigmOpen}
        setOpen={setVeradigmOpen}
        onClick={handleToggleVeradigmPanel}
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
