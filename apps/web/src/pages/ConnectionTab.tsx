import React, { useCallback, useState } from 'react';
import { RxDocument } from 'rxdb';

import { AppPage } from '../components/AppPage';
import { ConnectionCard } from '../components/connection/ConnectionCard';
import {
  EMRVendor,
  TenantSelectModal,
} from '../components/connection/TenantSelectModal';
import { GenericBanner } from '../components/GenericBanner';
import { useConnectionCards } from '../components/hooks/useConnectionCards';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import {
  CernerLocalStorageKeys,
  getLoginUrl as getCernerLoginUrl,
} from '../services/Cerner';
import {
  EpicLocalStorageKeys,
  getLoginUrl as getEpicLoginUrl,
} from '../services/Epic';
import * as OnPatient from '../services/OnPatient';
import { getLoginUrl as getVaLoginUrl } from '../services/VA';
import {
  getLoginUrl as getVeradigmLoginUrl,
  VeradigmLocalStorageKeys,
} from '../services/Veradigm';

export async function getLoginUrlBySource(
  item: RxDocument<ConnectionDocument>,
): Promise<string & Location> {
  switch (item.get('source')) {
    case 'epic': {
      const baseUrl = item.get('location');

      // to stay backwards compatible with old epic connections
      // append /oauth2/authorize to the end of the auth url, if it doesn't already exist
      let authUrl = item.get('auth_uri');
      if (authUrl === undefined) {
        authUrl = baseUrl + '/oauth2/authorize';
      }

      return getEpicLoginUrl(
        baseUrl,
        authUrl,
        item.get('tenant_id') === 'sandbox_epic' ||
          item.get('tenant_id') === '7c3b7890-360d-4a60-9ae1-ca7d10d5b354',
      );
    }
    case 'cerner': {
      return Promise.resolve(
        getCernerLoginUrl(item.get('location'), item.get('auth_uri')),
      );
    }
    case 'veradigm': {
      return Promise.resolve(
        getVeradigmLoginUrl(item.get('location'), item.get('auth_uri')),
      );
    }
    case 'onpatient': {
      return Promise.resolve(OnPatient.getLoginUrl());
    }
    case 'va': {
      return getVaLoginUrl();
    }
    default: {
      return '' as string & Location;
    }
  }
}

export function setTenantUrlBySource(
  item: RxDocument<ConnectionDocument>,
): void {
  switch (item.get('source')) {
    case 'epic': {
      // to stay backwards compatible with old epic connections
      // append /api/FHIR/DSTU2/ to the end of the base url, if it doesn't already exist
      let baseUrl = item.get('location');
      if (
        !baseUrl.endsWith('/api/FHIR/DSTU2/') &&
        !baseUrl.endsWith('/api/FHIR/DSTU2')
      ) {
        baseUrl = baseUrl + '/api/FHIR/DSTU2/';
      }

      // to stay backwards compatible with old epic connections
      // append /oauth2/authorize to the end of the auth url, if it doesn't already exist
      let authUrl = item.get('auth_uri');
      if (authUrl === undefined) {
        authUrl = baseUrl + '/oauth2/authorize';
      }

      let tokenUrl = item.get('token_uri');
      if (tokenUrl === undefined) {
        tokenUrl = baseUrl + '/oauth2/token';
      }

      setTenantEpicUrl(
        baseUrl,
        authUrl,
        tokenUrl,
        item.get('name'),
        item.get('tenant_id'),
      );
      break;
    }
    case 'cerner': {
      setTenantCernerUrl(
        item.get('location'),
        item.get('auth_uri'),
        item.get('token_uri'),
        item.get('name'),
        item.get('id'),
        item.get('fhir_version') || 'DSTU2',
      );
      break;
    }
    case 'veradigm': {
      setTenantVeradigmUrl(
        item.get('location'),
        item.get('auth_uri'),
        item.get('token_uri'),
        item.get('name'),
        item.get('id'),
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
  a: string & Location,
  t: string & Location,
  name: string,
  id: string,
): void {
  localStorage.setItem(EpicLocalStorageKeys.EPIC_BASE_URL, s);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_AUTH_URL, a);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_TOKEN_URL, t);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_NAME, name);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_ID, id);
}

function setTenantCernerUrl(
  base: string & Location,
  auth: string & Location,
  token: string & Location,
  name: string,
  id: string,
  fhirVersion: 'DSTU2' | 'R4',
): void {
  localStorage.setItem(CernerLocalStorageKeys.CERNER_BASE_URL, base);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_AUTH_URL, auth);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_TOKEN_URL, token);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_NAME, name);
  localStorage.setItem(CernerLocalStorageKeys.CERNER_ID, id);
  localStorage.setItem(CernerLocalStorageKeys.FHIR_VERSION, fhirVersion);
}

function setTenantVeradigmUrl(
  base: string & Location,
  auth: string & Location,
  token: string & Location,
  name: string,
  id: string,
): void {
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_BASE_URL, base);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_AUTH_URL, auth);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_TOKEN_URL, token);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_NAME, name);
  localStorage.setItem(VeradigmLocalStorageKeys.VERADIGM_ID, id);
}

const ConnectionTab: React.FC = () => {
  const list = useConnectionCards(),
    [openSelectModal, setOpenSelectModal] = useState(false),
    handleTogglePanel = useCallback(
      (
        base: string & Location,
        auth: string & Location,
        token: string & Location,
        name: string,
        id: string,
        vendor: EMRVendor,
        fhirVersion?: 'DSTU2' | 'R4',
      ) => {
        switch (vendor) {
          case 'epic': {
            setTenantEpicUrl(base, auth, token, name, id);
            setOpenSelectModal((x) => !x);
            window.location = getEpicLoginUrl(
              base,
              auth,
              id === 'sandbox_epic',
            );
            break;
          }
          case 'cerner': {
            setTenantCernerUrl(base, auth, token, name, id, fhirVersion || 'R4');
            setOpenSelectModal((x) => !x);
            window.location = getCernerLoginUrl(base, auth);
            break;
          }
          case 'cerner_r4': {
            setTenantCernerUrl(base, auth, token, name, id, fhirVersion || 'DSTU2');
            setOpenSelectModal((x) => !x);
            window.location = getCernerLoginUrl(base, auth);
            break;
          }
          case 'veradigm': {
            setTenantVeradigmUrl(base, auth, token, name, id);
            setOpenSelectModal((x) => !x);
            window.location = getVeradigmLoginUrl(base, auth);
            break;
          }
        }
      },
      [],
    );

  return (
    <AppPage banner={<GenericBanner text="Add Connections" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
        <div className="py-6 text-xl font-extrabold">
          Connect to Patient Portal
        </div>
        <div className="text-sm font-medium text-gray-800">
          Connect to a patient portal to automatic download your most recent
          data.
        </div>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pb-20 sm:px-6 sm:pb-6 lg:px-8">
        <ul className="grid grid-cols-1 pt-8">
          {list?.map((item) => (
            <ConnectionCard
              key={item.id}
              item={item}
              baseUrl={item.get('location')}
            />
          ))}
        </ul>
        {/* <div className="mb-4 box-border	flex w-full justify-center align-middle">
          <a href={vaUrl} className="w-full">
            <button className="bg-primary hover:bg-primary-600 active:bg-primary-700 active:scale-[98%] w-full rounded-lg p-4 text-white duration-75">
              <p className="font-bold">Log in to the VA</p>
            </button>
          </a>
        </div> */}
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          <button
            className="bg-primary hover:bg-primary-600 active:bg-primary-700 w-full rounded-lg p-4 text-white duration-75 active:scale-[98%]"
            onClick={() => setOpenSelectModal((x) => !x)}
          >
            <p className="font-bold">Add a new connection</p>
          </button>
        </div>
      </div>
      <TenantSelectModal
        open={openSelectModal}
        setOpen={setOpenSelectModal}
        onClick={handleTogglePanel}
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
