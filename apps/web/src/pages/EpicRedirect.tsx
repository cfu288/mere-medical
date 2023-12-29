import { useEffect, useRef, useState } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import { RxDatabase } from 'rxdb';
import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import {
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { Routes } from '../Routes';
import {
  DynamicRegistrationError,
  EpicDynamicRegistrationResponse,
  EpicLocalStorageKeys,
  fetchAccessTokenUsingJWT,
  fetchAccessTokenWithCode,
  registerDynamicClient,
  saveConnectionToDb,
} from '../services/Epic';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { useUserPreferences } from '../components/providers/UserPreferencesProvider';
import { useUser } from '../components/providers/UserProvider';
import { UserDocument } from '../models/user-document/UserDocument.type';

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
function useEpicDynamicRegistrationLogin() {
  const db = useRxDb(),
    user = useUser(),
    [error, setError] = useState(''),
    notifyDispatch = useNotificationDispatch(),
    userPreferences = useUserPreferences(),
    navigate = useNavigate(),
    hasRun = useRef(false);

  useEffect(() => {
    if (!hasRun.current) {
      const searchRequest = new URLSearchParams(window.location.search),
        code = searchRequest.get('code'),
        epicBaseUrl = localStorage.getItem(EpicLocalStorageKeys.EPIC_BASE_URL),
        epicTokenUrl = localStorage.getItem(
          EpicLocalStorageKeys.EPIC_TOKEN_URL
        ),
        epicAuthUrl = localStorage.getItem(EpicLocalStorageKeys.EPIC_AUTH_URL),
        epicName = localStorage.getItem(EpicLocalStorageKeys.EPIC_NAME),
        epicId = localStorage.getItem(EpicLocalStorageKeys.EPIC_ID);

      if (
        code &&
        epicBaseUrl &&
        epicName &&
        epicTokenUrl &&
        epicAuthUrl &&
        epicId &&
        userPreferences &&
        user
      ) {
        hasRun.current = true;
        handleLogin({
          code,
          epicBaseUrl,
          epicTokenUrl,
          epicAuthUrl,
          epicId,
          epicName,
          db,
          navigate,
          user,
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
        if (!(code && epicBaseUrl && epicName && epicId)) {
          setError('There was a problem trying to sign in');
        }
        // Otherwise, we're just pulling data
      }
    }
  }, [
    db,
    db.connection_documents,
    notifyDispatch,
    userPreferences?.use_proxy,
    user,
    navigate,
    userPreferences,
  ]);

  return [error];
}

const EpicRedirect: React.FC = () => {
  const navigate = useNavigate(),
    [error] = useEpicDynamicRegistrationLogin();

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
          <h1 className="font-xl mb-4 p-8 text-gray-600">
            You can try enabling proxy authentication in the settings section if
            login continues to fail
          </h1>
          <div className="flex flex-row justify-center gap-x-4">
            <button
              className="border-primary-700 text-primary w-36 rounded-lg border-2 bg-white p-4"
              onClick={() => navigate(`${Routes.Settings}#use_proxy`)}
            >
              Go to Settings
            </button>
            <button
              className="bg-primary w-36 rounded-lg p-4 text-white"
              onClick={() => navigate(Routes.AddConnection)}
            >
              Go Back
            </button>
          </div>
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

const redirectToConnectionsTab = (navigate: NavigateFunction) => {
  navigate(Routes.AddConnection);
};

/**
 * Handles the login process for Epic, with fallbacks to a proxy server if needed
 * @param param0
 * @returns Promise<void>
 */
const handleLogin = async ({
  code,
  epicBaseUrl,
  epicTokenUrl,
  epicAuthUrl,
  epicId,
  epicName,
  db,
  navigate,
  user,
  enableProxy = false,
}: {
  code: string;
  epicBaseUrl: string;
  epicTokenUrl: string;
  epicAuthUrl: string;
  epicName: string;
  epicId: string;
  db: RxDatabase<DatabaseCollections>;
  navigate: NavigateFunction;
  user: UserDocument;
  enableProxy?: boolean;
}) => {
  let dynamicRegResponse: EpicDynamicRegistrationResponse;

  // Attempt initial code swap
  const initalAuthResponse = await fetchAccessTokenWithCode(
    code,
    epicTokenUrl,
    epicName,
    epicId,
    enableProxy
  );

  // Attempt dynamic registration
  try {
    dynamicRegResponse = await registerDynamicClient({
      res: initalAuthResponse,
      epicBaseUrl,
      epicName,
      epicId,
      useProxy: enableProxy,
    });
  } catch (e) {
    // Failed, save current access token without dynamic registration
    if (e instanceof DynamicRegistrationError) {
      const res = e.data;
      await saveConnectionToDb({
        res,
        epicBaseUrl,
        epicTokenUrl,
        epicAuthUrl,
        epicName,
        db,
        epicId,
        user,
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
  const jwtAuthResponse = await fetchAccessTokenUsingJWT(
    dynamicRegResponse.client_id,
    epicTokenUrl,
    epicId,
    enableProxy
  );

  await saveConnectionToDb({
    res: jwtAuthResponse,
    epicBaseUrl,
    epicTokenUrl,
    epicAuthUrl,
    epicName,
    db,
    epicId,
    user,
  });
  return await redirectToConnectionsTab(navigate);
};
