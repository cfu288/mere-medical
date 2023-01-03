import { useEffect, useState } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { Routes } from '../Routes';
import {
  DynamicRegistrationError,
  EpicAuthResponse,
  EpicDynamicRegistrationResponse,
  EpicLocalStorageKeys,
  fetchAccessTokenUsingJWT,
  fetchAccessTokenWithCode,
  registerDynamicClient,
  saveConnectionToDb,
} from '../services/Epic';
import { useNotificationDispatch } from '../services/NotificationContext';
import { History, LocationState } from 'history';
import { useUserPreferences } from '../components/UserPreferencesProvider';

/**
 * Handles the redirect from Epic's authorization server. If possible, it
 * will attempt to register a dynamic client so we can automatically refresh
 * tokens in the future. If that fails, it will attempt to use the access
 * token provided by Epic to pull FHIR resources once and we will need the
 * user to manually re-sign in every time they want to manually pull their
 * records.
 * Ideally, we would use the conformance statement to determine whether or
 * not we can register a dynamic client, but Epic's conformance statement at
 * `api/FHIR/DSTU2/metadata` at `rest.security.extensions` is mostly inaccurate
 * anyways so we can't tell.
 */
const EpicRedirect: React.FC = () => {
  const navigate = useNavigate(),
    db = useRxDb(),
    [error, setError] = useState(''),
    notifyDispatch = useNotificationDispatch();

  const { userPreferences } = useUserPreferences();

  useEffect(() => {
    const searchRequest = new URLSearchParams(window.location.search),
      code = searchRequest.get('code'),
      epicUrl = localStorage.getItem(EpicLocalStorageKeys.EPIC_URL),
      epicName = localStorage.getItem(EpicLocalStorageKeys.EPIC_NAME),
      epicId = localStorage.getItem(EpicLocalStorageKeys.EPIC_ID);

    if (code && epicUrl && epicName && epicId && userPreferences) {
      handleLogin({
        code,
        epicUrl,
        epicId,
        epicName,
        db,
        navigate,
        enableProxy: userPreferences?.use_proxy,
      })
        .then()
        .catch((e) => {
          if (e instanceof DynamicRegistrationError) {
            notifyDispatch({
              type: 'set_notification',
              message: `${e.message}`,
              variant: 'error',
            });
            redirectToConnectionsTab(navigate);
          } else {
            notifyDispatch({
              type: 'set_notification',
              message: `${(e as Error).message}`,
              variant: 'error',
            });
            setError(`${(e as Error).message}`);
          }
        });
    } else {
      setError('There was a problem trying to sign in');
    }
  }, [db, db.connection_documents, navigate, notifyDispatch, userPreferences]);

  return (
    <AppPage
      banner={
        <GenericBanner
          text={
            !error
              ? 'Authenticated! Redirecting'
              : 'There was a problem trying to sign in'
          }
        />
      }
    >
      {error && (
        <div className="flex h-full flex-col items-center justify-center">
          <h1 className="font-2xl mb-4 font-bold text-red-700">{error}</h1>
          <button
            className="bg-primary rounded-lg p-4 text-white"
            onClick={() => navigate(Routes.AddConnection)}
          >
            Go Back
          </button>
        </div>
      )}
      {!error && (
        <div className="flex-column flex h-full w-full items-center justify-center">
          <svg
            aria-hidden="true"
            className="fill-primary-700 mr-2 h-64 w-64 animate-spin text-gray-200 dark:text-gray-600"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>
        </div>
      )}
    </AppPage>
  );
};

export default EpicRedirect;

const redirectToConnectionsTab = (navigate: any) => {
  navigate(Routes.AddConnection);
};

/**
 * Handles the login process for Epic, with fallbacks to a proxy server if needed
 * @param param0
 * @returns Promise<void>
 */
const handleLogin = async ({
  code,
  epicUrl,
  epicId,
  epicName,
  db,
  navigate,
  enableProxy = false,
}: {
  code: string;
  epicUrl: string;
  epicName: string;
  epicId: string;
  db: RxDatabase<DatabaseCollections>;
  navigate: NavigateFunction;
  enableProxy?: boolean;
}) => {
  let initalAuthResponse: EpicAuthResponse;
  let dynamicRegResponse: EpicDynamicRegistrationResponse;
  let jwtAuthResponse: EpicAuthResponse;

  // Attempt initial code swap
  try {
    initalAuthResponse = await fetchAccessTokenWithCode(
      code,
      epicUrl,
      epicName,
      epicId,
      enableProxy
    );
  } catch (e) {
    initalAuthResponse = await fetchAccessTokenWithCode(
      code,
      epicUrl,
      epicName,
      epicId,
      true
    );
  }

  // Attempt dynamic registration
  try {
    try {
      dynamicRegResponse = await registerDynamicClient({
        res: initalAuthResponse,
        epicUrl,
        epicName,
        epicId,
        useProxy: enableProxy,
      });
    } catch (e) {
      dynamicRegResponse = await registerDynamicClient({
        res: initalAuthResponse,
        epicUrl,
        epicName,
        epicId,
        useProxy: true,
      });
    }
  } catch (e) {
    if (e instanceof DynamicRegistrationError) {
      const res = e.data;
      await saveConnectionToDb({
        res,
        epicUrl,
        epicName,
        db,
        epicId,
      });
      return Promise.reject(
        new DynamicRegistrationError(
          'This MyChart instance does not support dynamic client registration, which means we cannot automatically fetch your records in the future. We will still try to pull your records once, but you will need to sign in again to pull them again in the future.',
          res
        )
      );
    }
    return Promise.reject(
      new Error('There was an error registering you at this MyChart instance')
    );
  }

  // Using DR to fetch new token
  try {
    jwtAuthResponse = await fetchAccessTokenUsingJWT(
      dynamicRegResponse.client_id,
      epicUrl,
      epicId,
      enableProxy
    );
  } catch (e) {
    jwtAuthResponse = await fetchAccessTokenUsingJWT(
      dynamicRegResponse.client_id,
      epicUrl,
      epicId,
      true
    );
  }
  await saveConnectionToDb({
    res: jwtAuthResponse,
    epicUrl,
    epicName,
    db,
    epicId,
  });
  return await redirectToConnectionsTab(navigate);
};
