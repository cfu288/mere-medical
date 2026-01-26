import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { Routes } from '../../../Routes';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { AppPage } from '../../../shared/components/AppPage';
import { GenericBanner } from '../../../shared/components/GenericBanner';
import { useUser } from '../../../app/providers/UserProvider';
import { useAppConfig } from '../../../app/providers/AppConfigProvider';
import {
  VeradigmLocalStorageKeys,
  saveConnectionToDb,
} from '../../../services/fhir/Veradigm';
import {
  createVeradigmClient,
  buildVeradigmOAuthConfig,
} from '@mere/fhir-oauth';

const veradigmClient = createVeradigmClient();

function clearLocalStorage() {
  Object.values(VeradigmLocalStorageKeys).forEach((key) =>
    localStorage.removeItem(key),
  );
}

const VeradigmRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { config, isLoading } = useAppConfig();
  const user = useUser();
  const db = useRxDb();
  const notifyDispatch = useNotificationDispatch();
  const [error, setError] = useState('');
  const hasRun = useRef(false);
  const { search } = useLocation();

  useEffect(() => {
    if (isLoading || hasRun.current) return;

    hasRun.current = true;

    const searchParams = new URLSearchParams(search);
    const errorMsg = searchParams.get('error');
    const errorMsgDescription = searchParams.get('error_description');
    const veradigmUrl = localStorage.getItem(
      VeradigmLocalStorageKeys.VERADIGM_BASE_URL,
    );
    const veradigmName = localStorage.getItem(
      VeradigmLocalStorageKeys.VERADIGM_NAME,
    );
    const veradigmAuthUrl = localStorage.getItem(
      VeradigmLocalStorageKeys.VERADIGM_AUTH_URL,
    );
    const veradigmTokenUrl = localStorage.getItem(
      VeradigmLocalStorageKeys.VERADIGM_TOKEN_URL,
    );
    const veradigmId = localStorage.getItem(
      VeradigmLocalStorageKeys.VERADIGM_ID,
    );

    if (errorMsg) {
      clearLocalStorage();
      setError(`${errorMsg}: ${errorMsgDescription || 'Unknown error'}`);
      return;
    }

    if (
      !veradigmTokenUrl ||
      !veradigmAuthUrl ||
      !veradigmUrl ||
      !veradigmName ||
      !veradigmId ||
      !user?.id
    ) {
      clearLocalStorage();
      notifyDispatch({
        type: 'set_notification',
        message: `Error adding connection: missing required parameters`,
        variant: 'error',
      });
      navigate(Routes.AddConnection);
      return;
    }

    if (!config.VERADIGM_CLIENT_ID || !config.PUBLIC_URL) {
      clearLocalStorage();
      notifyDispatch({
        type: 'set_notification',
        message: 'Veradigm OAuth configuration is incomplete',
        variant: 'error',
      });
      navigate(Routes.AddConnection);
      return;
    }

    const oauthConfig = buildVeradigmOAuthConfig({
      clientId: config.VERADIGM_CLIENT_ID,
      publicUrl: config.PUBLIC_URL,
      redirectPath: Routes.VeradigmCallback,
      tenant: {
        id: veradigmUrl,
        name: veradigmName,
        authUrl: veradigmAuthUrl,
        tokenUrl: veradigmTokenUrl,
        fhirBaseUrl: veradigmUrl,
      },
    });

    veradigmClient
      .handleCallback(searchParams, oauthConfig, { startedAt: 0 })
      .then((tokens) => {
        saveConnectionToDb({
          tokens,
          veradigmBaseUrl: veradigmUrl,
          veradigmId,
          db,
          user,
          name: veradigmName,
          auth_uri: veradigmAuthUrl,
          token_uri: veradigmTokenUrl,
        })
          .then(() => {
            clearLocalStorage();
            navigate(Routes.AddConnection);
          })
          .catch((e) => {
            console.error(e);
            clearLocalStorage();
            notifyDispatch({
              type: 'set_notification',
              message: `Error adding connection: ${(e as Error).message}`,
              variant: 'error',
            });
            navigate(Routes.AddConnection);
          });
      })
      .catch((e) => {
        clearLocalStorage();
        setError(`${(e as Error).message}`);
        notifyDispatch({
          type: 'set_notification',
          message: `Error adding connection: ${(e as Error).message}`,
          variant: 'error',
        });
      });
  }, [config, isLoading, db, navigate, notifyDispatch, search, user]);

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

export default VeradigmRedirect;
