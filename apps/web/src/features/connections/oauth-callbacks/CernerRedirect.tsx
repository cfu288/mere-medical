import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import uuid4 from '../../../shared/utils/UUIDUtils';
import { CreateCernerConnectionDocument } from '../../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { Routes } from '../../../Routes';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { AppPage } from '../../../shared/components/AppPage';
import { GenericBanner } from '../../../shared/components/GenericBanner';
import { useUser } from '../../../app/providers/UserProvider';
import { useAppConfig } from '../../../app/providers/AppConfigProvider';
import {
  CernerLocalStorageKeys,
  CERNER_CODE_VERIFIER_KEY,
  CERNER_OAUTH_STATE_KEY,
  fetchAccessTokenWithCode,
} from '../../../services/fhir/Cerner';
import { createConnection } from '../../../repositories/ConnectionRepository';
import {
  clearPkceSession,
  getCodeVerifier,
  validateOAuthState,
} from '../../../shared/utils/pkceUtils';

function clearCernerSession() {
  localStorage.removeItem(CernerLocalStorageKeys.CERNER_BASE_URL);
  localStorage.removeItem(CernerLocalStorageKeys.CERNER_AUTH_URL);
  localStorage.removeItem(CernerLocalStorageKeys.CERNER_TOKEN_URL);
  localStorage.removeItem(CernerLocalStorageKeys.CERNER_NAME);
  localStorage.removeItem(CernerLocalStorageKeys.CERNER_ID);
  localStorage.removeItem(CernerLocalStorageKeys.FHIR_VERSION);
  clearPkceSession(CERNER_CODE_VERIFIER_KEY, CERNER_OAUTH_STATE_KEY);
}

const CernerRedirect: React.FC = () => {
  const navigate = useNavigate(),
    { config, isLoading } = useAppConfig(),
    user = useUser(),
    db = useRxDb(),
    notifyDispatch = useNotificationDispatch(),
    hasRun = useRef(false),
    [error, setError] = useState(''),
    { search } = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!hasRun.current) {
      hasRun.current = true;
      const searchRequest = new URLSearchParams(search),
        code = searchRequest.get('code'),
        returnedState = searchRequest.get('state'),
        cernerUrl = localStorage.getItem(
          CernerLocalStorageKeys.CERNER_BASE_URL,
        ),
        cernerName = localStorage.getItem(CernerLocalStorageKeys.CERNER_NAME),
        cernerAuthUrl = localStorage.getItem(
          CernerLocalStorageKeys.CERNER_AUTH_URL,
        ),
        cernerTokenUrl = localStorage.getItem(
          CernerLocalStorageKeys.CERNER_TOKEN_URL,
        ),
        storedFhirVersion = localStorage.getItem(
          CernerLocalStorageKeys.FHIR_VERSION,
        ) as 'DSTU2' | 'R4' | null,
        codeVerifier = getCodeVerifier(CERNER_CODE_VERIFIER_KEY);

      if (!validateOAuthState(returnedState, CERNER_OAUTH_STATE_KEY)) {
        setError('OAuth state mismatch. Please try again.');
        clearCernerSession();
        return;
      }

      if (code && cernerUrl && cernerName && cernerAuthUrl && cernerTokenUrl) {
        const tokenEndpoint = cernerTokenUrl;
        fetchAccessTokenWithCode(config, code, tokenEndpoint, codeVerifier)
          .then((res) => {
            if (
              res.access_token &&
              res.refresh_token &&
              res.expires_in &&
              res.id_token &&
              user.id
            ) {
              const nowInSeconds = Math.floor(Date.now() / 1000);
              const fhirVersion =
                storedFhirVersion ||
                (cernerUrl.toUpperCase().includes('/R4') ? 'R4' : 'DSTU2');
              const dbentry: Omit<CreateCernerConnectionDocument, 'patient'> = {
                id: uuid4(),
                user_id: user.id,
                source: 'cerner',
                location: cernerUrl,
                name: cernerName,
                access_token: res.access_token,
                scope: res.scope,
                id_token: res.id_token,
                refresh_token: res.refresh_token,
                expires_at: nowInSeconds + res.expires_in,
                auth_uri: cernerAuthUrl,
                token_uri: cernerTokenUrl,
                fhir_version: fhirVersion,
              };
              createConnection(db, dbentry as any)
                .catch((e: unknown) => {
                  notifyDispatch({
                    type: 'set_notification',
                    message: `Error adding connection: ${(e as Error).message}`,
                    variant: 'error',
                  });
                })
                .finally(() => {
                  clearCernerSession();
                  navigate(Routes.AddConnection);
                });
            } else {
              clearCernerSession();
              notifyDispatch({
                type: 'set_notification',
                message: `Error completing authentication: no access token provided`,
                variant: 'error',
              });
            }
          })
          .catch((e) => {
            clearCernerSession();
            notifyDispatch({
              type: 'set_notification',
              message: `Error adding connection: ${(e as Error).message}`,
              variant: 'error',
            });
            navigate(Routes.AddConnection);
          });
      } else {
        clearCernerSession();
        notifyDispatch({
          type: 'set_notification',
          message: `Error adding connection: missing required parameters`,
          variant: 'error',
        });
        console.error('Missing required parameters');
        const missingParams = [
          !code ? 'code' : '',
          !cernerUrl ? 'cernerUrl' : '',
          !cernerName ? 'cernerName' : '',
          !cernerAuthUrl ? 'cernerAuthUrl' : '',
          !cernerTokenUrl ? 'cernerTokenUrl' : '',
        ]
          .filter((x) => x)
          .join(', ');
        setError(
          `There was a problem trying to sign in: Missing parameters: ${missingParams}`,
        );
      }
    }
  }, [
    config,
    isLoading,
    db.connection_documents,
    navigate,
    notifyDispatch,
    search,
    user.id,
  ]);

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
      {error ? (
        <div className="flex h-full flex-col items-center justify-center">
          <h1 className="font-2xl mb-4 font-bold text-red-700">{error}</h1>
          <div className="flex flex-row justify-center gap-x-4">
            <button
              className="bg-primary w-36 rounded-lg p-4 text-white"
              onClick={() => navigate(Routes.AddConnection)}
            >
              Go Back
            </button>
          </div>
        </div>
      ) : (
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

export default CernerRedirect;
