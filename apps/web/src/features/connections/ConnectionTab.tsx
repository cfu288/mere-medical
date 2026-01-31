import React, { useCallback, useState } from 'react';
import { RxDocument } from 'rxdb';

import {
  createEpicClient,
  createCernerClient,
  createSessionManager,
  buildEpicOAuthConfig,
  buildCernerOAuthConfig,
  buildOnPatientAuthUrl,
  EPIC_DEFAULT_SCOPES,
  CERNER_DEFAULT_SCOPES,
  createVeradigmClient,
  buildVeradigmOAuthConfig,
  createHealowClient,
  buildHealowOAuthConfig,
} from '@mere/fhir-oauth';
import { signJwt } from '@mere/crypto/browser';
import { isEpicSandbox } from '../../services/fhir/EpicUtils';
import { AppPage } from '../../shared/components/AppPage';
import { ConnectionCard } from './components/ConnectionCard';
import { EMRVendor, TenantSelectModal } from './components/TenantSelectModal';
import { GenericBanner } from '../../shared/components/GenericBanner';
import { useConnectionCards } from './hooks/useConnectionCards';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { AppConfig, useConfig } from '../../app/providers/AppConfigProvider';
import { CernerLocalStorageKeys } from '../../services/fhir/Cerner';
import {
  EpicLocalStorageKeys,
  getEpicClientId,
  getDSTU2Url,
  getR4Url,
} from '../../services/fhir/Epic';
import { getLoginUrl as getVaLoginUrl } from '../../services/fhir/VA';
import { VeradigmLocalStorageKeys } from '../../services/fhir/Veradigm';
import { HealowLocalStorageKeys } from '../../services/fhir/Healow';
import { Routes } from '../../Routes';

const epicClient = createEpicClient({ signJwt });
const cernerClient = createCernerClient();
const veradigmClient = createVeradigmClient();
const healowClient = createHealowClient();
const epicSession = createSessionManager('epic');
const cernerSession = createSessionManager('cerner');
const healowSession = createSessionManager('healow');

/**
 * Initiates OAuth authorization flow for Epic MyChart connections.
 * Generates PKCE challenge, stores session state, and returns the authorization URL.
 * The callback page will use the stored session to complete the token exchange.
 *
 * @param config - App configuration containing Epic client IDs and public URL
 * @param baseUrl - Epic FHIR server base URL
 * @param authUrl - OAuth authorization endpoint URL
 * @param tokenUrl - OAuth token endpoint URL
 * @param name - Display name for the connection
 * @param id - Epic tenant identifier
 * @param fhirVersion - FHIR version (DSTU2 or R4)
 * @returns Authorization URL to redirect the user to in order to initiate auth
 */
async function initiateEpicAuth(
  config: AppConfig,
  baseUrl: string,
  authUrl: string,
  tokenUrl: string,
  name: string,
  id: string,
  fhirVersion: 'DSTU2' | 'R4',
): Promise<string> {
  const isSandbox = isEpicSandbox(id);
  const clientId = getEpicClientId(config, fhirVersion, isSandbox);
  if (!clientId || !config.PUBLIC_URL) {
    throw new Error('Epic OAuth configuration is incomplete');
  }

  const fhirBaseUrl =
    fhirVersion === 'R4' ? getR4Url(baseUrl) : getDSTU2Url(baseUrl);

  const oauthConfig = buildEpicOAuthConfig({
    clientId,
    publicUrl: config.PUBLIC_URL,
    redirectPath: Routes.EpicCallback,
    scopes: EPIC_DEFAULT_SCOPES,
    tenant: {
      id,
      name,
      authUrl,
      tokenUrl,
      fhirBaseUrl,
      fhirVersion,
    },
  });

  const { url, session } = await epicClient.initiateAuth(oauthConfig);
  await epicSession.save(session);
  return url;
}

/**
 * Initiates OAuth authorization flow for Cerner connections.
 * Generates PKCE challenge, stores session state, and returns the authorization URL.
 * The callback page will use the stored session to complete the token exchange.
 *
 * @param config - App configuration containing Cerner client ID and public URL
 * @param baseUrl - Cerner FHIR server base URL
 * @param authUrl - OAuth authorization endpoint URL
 * @param tokenUrl - OAuth token endpoint URL
 * @param name - Display name for the connection
 * @param id - Cerner tenant identifier
 * @param fhirVersion - FHIR version (DSTU2 or R4)
 * @returns Authorization URL to redirect the user to
 */
async function initiateCernerAuth(
  config: AppConfig,
  baseUrl: string,
  authUrl: string,
  tokenUrl: string,
  name: string,
  id: string,
  fhirVersion: 'DSTU2' | 'R4',
): Promise<string> {
  if (!config.CERNER_CLIENT_ID || !config.PUBLIC_URL) {
    throw new Error('Cerner OAuth configuration is incomplete');
  }

  const oauthConfig = buildCernerOAuthConfig({
    clientId: config.CERNER_CLIENT_ID,
    publicUrl: config.PUBLIC_URL,
    redirectPath: Routes.CernerCallback,
    scopes: CERNER_DEFAULT_SCOPES,
    tenant: {
      id,
      name,
      authUrl,
      tokenUrl,
      fhirBaseUrl: baseUrl,
      fhirVersion,
    },
  });

  const { url, session } = await cernerClient.initiateAuth(oauthConfig);
  await cernerSession.save(session);
  return url;
}

/**
 * Returns the OnPatient OAuth authorization URL.
 * OnPatient uses a confidential client flow where the backend handles token exchange,
 * so no PKCE or session storage is needed on the frontend.
 *
 * @param config - App configuration containing OnPatient client ID and public URL
 * @returns Authorization URL to redirect the user to
 */
function initiateOnPatientAuth(config: AppConfig): string {
  if (!config.ONPATIENT_CLIENT_ID || !config.PUBLIC_URL) {
    throw new Error('OnPatient OAuth configuration is incomplete');
  }

  return buildOnPatientAuthUrl({
    clientId: config.ONPATIENT_CLIENT_ID,
    publicUrl: config.PUBLIC_URL,
    redirectPath: '/api/v1/onpatient/callback',
  });
}

/**
 * Initiates OAuth authorization flow for Veradigm (Allscripts) connections.
 * Veradigm does not use PKCE, so no session storage is needed.
 *
 * @param config - App configuration containing Veradigm client ID and public URL
 * @param baseUrl - Veradigm FHIR server base URL
 * @param authUrl - OAuth authorization endpoint URL
 * @param tokenUrl - OAuth token endpoint URL
 * @param name - Display name for the connection
 * @returns Authorization URL to redirect the user to
 */
async function initiateVeradigmAuth(
  config: AppConfig,
  baseUrl: string,
  authUrl: string,
  tokenUrl: string,
  name: string,
): Promise<string> {
  if (!config.VERADIGM_CLIENT_ID || !config.PUBLIC_URL) {
    throw new Error('Veradigm OAuth configuration is incomplete');
  }

  const oauthConfig = buildVeradigmOAuthConfig({
    clientId: config.VERADIGM_CLIENT_ID,
    publicUrl: config.PUBLIC_URL,
    redirectPath: Routes.VeradigmCallback,
    tenant: {
      id: baseUrl,
      name,
      authUrl,
      tokenUrl,
      fhirBaseUrl: baseUrl,
    },
  });

  const { url } = await veradigmClient.initiateAuth(oauthConfig);
  return url;
}

/**
 * Initiates OAuth authorization flow for Healow connections.
 * Generates PKCE challenge, stores session state, and returns the authorization URL.
 * The callback page will use the stored session to complete the token exchange.
 *
 * @param config - App configuration containing Healow client ID and public URL
 * @param baseUrl - Healow FHIR server base URL
 * @param authUrl - OAuth authorization endpoint URL
 * @param tokenUrl - OAuth token endpoint URL
 * @param name - Display name for the connection
 * @param id - Healow tenant identifier
 * @returns Authorization URL to redirect the user to
 */
async function initiateHealowAuth(
  config: AppConfig,
  baseUrl: string,
  authUrl: string,
  tokenUrl: string,
  name: string,
  id: string,
): Promise<string> {
  if (!config.HEALOW_CLIENT_ID || !config.PUBLIC_URL) {
    throw new Error('Healow OAuth configuration is incomplete');
  }

  const oauthConfig = buildHealowOAuthConfig({
    clientId: config.HEALOW_CLIENT_ID,
    publicUrl: config.PUBLIC_URL,
    redirectPath: Routes.HealowCallback,
    confidentialMode: config.HEALOW_CONFIDENTIAL_MODE,
    tenant: {
      id,
      name,
      authUrl,
      tokenUrl,
      fhirBaseUrl: baseUrl,
    },
  });

  const { url, session } = await healowClient.initiateAuth(oauthConfig);
  await healowSession.save(session);
  return url;
}

export async function getLoginUrlBySource(
  config: AppConfig,
  item: RxDocument<ConnectionDocument>,
): Promise<string & Location> {
  switch (item.get('source')) {
    case 'epic': {
      let baseUrl = item.get('location');
      const fhirVersion = (item.get('fhir_version') || 'DSTU2') as
        | 'DSTU2'
        | 'R4';

      if (fhirVersion === 'R4') {
        if (!baseUrl.includes('/api/FHIR/R4')) {
          baseUrl = baseUrl + '/api/FHIR/R4/';
        }
      } else {
        if (!baseUrl.includes('/api/FHIR/DSTU2')) {
          baseUrl = baseUrl + '/api/FHIR/DSTU2/';
        }
      }

      let authUrl = item.get('auth_uri');
      if (authUrl === undefined) {
        authUrl = baseUrl + '/oauth2/authorize';
      }

      let tokenUrl = item.get('token_uri');
      if (tokenUrl === undefined) {
        tokenUrl = baseUrl + '/oauth2/token';
      }

      const url = await initiateEpicAuth(
        config,
        baseUrl,
        authUrl,
        tokenUrl,
        item.get('name'),
        item.get('tenant_id'),
        fhirVersion,
      );
      return url as string & Location;
    }
    case 'cerner': {
      const fhirVersion = (item.get('fhir_version') || 'DSTU2') as
        | 'DSTU2'
        | 'R4';
      const url = await initiateCernerAuth(
        config,
        item.get('location'),
        item.get('auth_uri'),
        item.get('token_uri'),
        item.get('name'),
        item.get('id'),
        fhirVersion,
      );
      return url as string & Location;
    }
    case 'veradigm': {
      return initiateVeradigmAuth(
        config,
        item.get('location'),
        item.get('auth_uri'),
        item.get('token_uri'),
        item.get('name'),
      ).then((url) => url as string & Location);
    }
    case 'onpatient': {
      return Promise.resolve(
        initiateOnPatientAuth(config) as string & Location,
      );
    }
    case 'va': {
      return getVaLoginUrl(config);
    }
    case 'healow': {
      return initiateHealowAuth(
        config,
        item.get('location'),
        item.get('auth_uri'),
        item.get('token_uri'),
        item.get('name'),
        item.get('tenant_id'),
      ).then((url) => url as string & Location);
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
      let baseUrl = item.get('location');
      const fhirVersion = item.get('fhir_version') || 'DSTU2';

      if (fhirVersion === 'R4') {
        if (!baseUrl.includes('/api/FHIR/R4')) {
          baseUrl = baseUrl + '/api/FHIR/R4/';
        }
      } else {
        if (!baseUrl.includes('/api/FHIR/DSTU2')) {
          baseUrl = baseUrl + '/api/FHIR/DSTU2/';
        }
      }

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
        fhirVersion,
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
        item.get('tenant_id'),
      );
      break;
    }
    case 'healow': {
      setTenantHealowUrl(
        item.get('location'),
        item.get('auth_uri'),
        item.get('token_uri'),
        item.get('name'),
        item.get('tenant_id'),
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
  fhirVersion: 'DSTU2' | 'R4',
): void {
  localStorage.setItem(EpicLocalStorageKeys.EPIC_BASE_URL, s);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_AUTH_URL, a);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_TOKEN_URL, t);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_NAME, name);
  localStorage.setItem(EpicLocalStorageKeys.EPIC_ID, id);
  localStorage.setItem(EpicLocalStorageKeys.FHIR_VERSION, fhirVersion);
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

function setTenantHealowUrl(
  base: string & Location,
  auth: string & Location,
  token: string & Location,
  name: string,
  id: string,
): void {
  localStorage.setItem(HealowLocalStorageKeys.HEALOW_BASE_URL, base);
  localStorage.setItem(HealowLocalStorageKeys.HEALOW_AUTH_URL, auth);
  localStorage.setItem(HealowLocalStorageKeys.HEALOW_TOKEN_URL, token);
  localStorage.setItem(HealowLocalStorageKeys.HEALOW_NAME, name);
  localStorage.setItem(HealowLocalStorageKeys.HEALOW_ID, id);
}

const ConnectionTab: React.FC = () => {
  const list = useConnectionCards(),
    config = useConfig(),
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
            setTenantEpicUrl(
              base,
              auth,
              token,
              name,
              id,
              fhirVersion || 'DSTU2',
            );
            setOpenSelectModal((x) => !x);
            initiateEpicAuth(
              config,
              base,
              auth,
              token,
              name,
              id,
              fhirVersion || 'DSTU2',
            ).then((url) => {
              window.location.href = url;
            });
            break;
          }
          case 'cerner': {
            setTenantCernerUrl(
              base,
              auth,
              token,
              name,
              id,
              fhirVersion || 'DSTU2',
            );
            setOpenSelectModal((x) => !x);
            initiateCernerAuth(
              config,
              base,
              auth,
              token,
              name,
              id,
              fhirVersion || 'DSTU2',
            ).then((url) => {
              window.location.href = url;
            });
            break;
          }
          case 'veradigm': {
            setTenantVeradigmUrl(base, auth, token, name, id);
            setOpenSelectModal((x) => !x);
            initiateVeradigmAuth(config, base, auth, token, name).then(
              (url) => {
                window.location.href = url;
              },
            );
            break;
          }
          case 'healow': {
            setTenantHealowUrl(base, auth, token, name, id);
            setOpenSelectModal((x) => !x);
            initiateHealowAuth(config, base, auth, token, name, id).then(
              (url) => {
                window.location.href = url;
              },
            );
            break;
          }
        }
      },
      [config],
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
