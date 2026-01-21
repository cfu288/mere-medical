import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createCernerClient,
  buildCernerOAuthConfig,
  CERNER_DEFAULT_SCOPES,
} from '@mere/fhir-oauth';
import {
  useOAuthFlow,
  useOAuthorizationRequestState,
} from '@mere/fhir-oauth/react';
import { AppPage } from '../../../shared/components/AppPage';
import { GenericBanner } from '../../../shared/components/GenericBanner';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { Routes } from '../../../Routes';
import { useAppConfig } from '../../../app/providers/AppConfigProvider';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { CernerLocalStorageKeys } from '../../../services/fhir/Cerner';
import { createConnection } from '../../../repositories/ConnectionRepository';
import uuid4 from '../../../shared/utils/UUIDUtils';
import type { CreateCernerConnectionDocument } from '../../../models/connection-document/ConnectionDocument.type';

const cernerClient = createCernerClient();

function useCernerOAuthCallback() {
  const db = useRxDb();
  const { config, isLoading: configLoading } = useAppConfig();
  const user = useUser();
  const navigate = useNavigate();
  const notifyDispatch = useNotificationDispatch();
  const { search } = useLocation();
  const hasRun = useRef(false);
  const [error, setError] = useState('');

  const { handleCallback } = useOAuthFlow({
    client: cernerClient,
    vendor: 'cerner',
  });
  const { clearSession } = useOAuthorizationRequestState('cerner');

  useEffect(() => {
    if (configLoading || hasRun.current) return;

    const searchParams = new URLSearchParams(search);
    const cernerBaseUrl = localStorage.getItem(
      CernerLocalStorageKeys.CERNER_BASE_URL,
    );
    const cernerTokenUrl = localStorage.getItem(
      CernerLocalStorageKeys.CERNER_TOKEN_URL,
    );
    const cernerAuthUrl = localStorage.getItem(
      CernerLocalStorageKeys.CERNER_AUTH_URL,
    );
    const cernerName = localStorage.getItem(CernerLocalStorageKeys.CERNER_NAME);
    const cernerId = localStorage.getItem(CernerLocalStorageKeys.CERNER_ID);
    const storedFhirVersion = localStorage.getItem(
      CernerLocalStorageKeys.FHIR_VERSION,
    ) as 'DSTU2' | 'R4' | null;

    if (
      !cernerBaseUrl ||
      !cernerTokenUrl ||
      !cernerAuthUrl ||
      !cernerName ||
      !cernerId ||
      !user?.id
    ) {
      hasRun.current = true;
      clearLocalStorage();
      clearSession();
      const missingParams = [
        !cernerBaseUrl && 'cernerBaseUrl',
        !cernerTokenUrl && 'cernerTokenUrl',
        !cernerAuthUrl && 'cernerAuthUrl',
        !cernerName && 'cernerName',
        !cernerId && 'cernerId',
        !user?.id && 'user',
      ]
        .filter(Boolean)
        .join(', ');
      const errorMessage = `Missing required parameters: ${missingParams}`;
      setError(errorMessage);
      notifyDispatch({
        type: 'set_notification',
        message: errorMessage,
        variant: 'error',
      });
      return;
    }

    hasRun.current = true;
    const fhirVersion =
      storedFhirVersion ||
      (cernerBaseUrl.toUpperCase().includes('/R4') ? 'R4' : 'DSTU2');

    const oauthConfig = buildCernerOAuthConfig({
      clientId: config.CERNER_CLIENT_ID,
      publicUrl: config.PUBLIC_URL,
      redirectPath: Routes.CernerCallback,
      scopes: CERNER_DEFAULT_SCOPES,
      tenant: {
        id: cernerId,
        name: cernerName,
        authUrl: cernerAuthUrl,
        tokenUrl: cernerTokenUrl,
        fhirBaseUrl: cernerBaseUrl,
        fhirVersion,
      },
    });

    (async () => {
      try {
        const tokens = await handleCallback(searchParams, oauthConfig);

        if (!tokens.refreshToken || !tokens.idToken) {
          throw new Error(
            'Missing required tokens from authentication response',
          );
        }

        const dbentry: Omit<CreateCernerConnectionDocument, 'patient'> = {
          id: uuid4(),
          user_id: user.id,
          source: 'cerner',
          location: cernerBaseUrl,
          name: cernerName,
          access_token: tokens.accessToken,
          scope: tokens.scope || '',
          id_token: tokens.idToken,
          refresh_token: tokens.refreshToken,
          expires_at: tokens.expiresAt,
          auth_uri: cernerAuthUrl,
          token_uri: cernerTokenUrl,
          fhir_version: fhirVersion,
        };

        await createConnection(db, dbentry as any);
        navigate(Routes.AddConnection, { replace: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Authentication failed';
        setError(message);
        notifyDispatch({
          type: 'set_notification',
          message,
          variant: 'error',
        });
      } finally {
        clearLocalStorage();
      }
    })();
  }, [
    configLoading,
    config,
    db,
    user,
    handleCallback,
    clearSession,
    navigate,
    notifyDispatch,
    search,
  ]);

  return error;
}

function clearLocalStorage() {
  Object.values(CernerLocalStorageKeys).forEach((key) =>
    localStorage.removeItem(key),
  );
}

const CernerRedirect: React.FC = () => {
  const navigate = useNavigate();
  const error = useCernerOAuthCallback();

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
