import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import uuid4 from '../../../shared/utils/UUIDUtils';
import { CreateHealowConnectionDocument } from '../../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { Routes } from '../../../Routes';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { AppPage } from '../../../shared/components/AppPage';
import { GenericBanner } from '../../../shared/components/GenericBanner';
import { useUser } from '../../../app/providers/UserProvider';
import { useConfig } from '../../../app/providers/AppConfigProvider';
import { useUserPreferences } from '../../../app/providers/UserPreferencesProvider';
import {
  HealowLocalStorageKeys,
  fetchAccessTokenWithCode,
} from '../../../services/fhir/Healow';
import { createConnection } from '../../../repositories/ConnectionRepository';

const HealowRedirect: React.FC = () => {
  const navigate = useNavigate(),
    user = useUser(),
    db = useRxDb(),
    config = useConfig(),
    userPreferences = useUserPreferences(),
    notifyDispatch = useNotificationDispatch(),
    hasRun = useRef(false),
    [error, setError] = useState(''),
    { search } = useLocation();

  useEffect(() => {
    if (!hasRun.current && userPreferences !== undefined) {
      hasRun.current = true;
      const searchRequest = new URLSearchParams(search),
        code = searchRequest.get('code'),
        healowUrl = localStorage.getItem(
          HealowLocalStorageKeys.HEALOW_BASE_URL,
        ),
        healowName = localStorage.getItem(HealowLocalStorageKeys.HEALOW_NAME),
        healowAuthUrl = localStorage.getItem(
          HealowLocalStorageKeys.HEALOW_AUTH_URL,
        ),
        healowTokenUrl = localStorage.getItem(
          HealowLocalStorageKeys.HEALOW_TOKEN_URL,
        );

      if (code && healowUrl && healowName && healowAuthUrl && healowTokenUrl) {
        const healowId = localStorage.getItem(HealowLocalStorageKeys.HEALOW_ID);
        fetchAccessTokenWithCode(
          code,
          healowTokenUrl,
          config.HEALOW_CLIENT_ID || '',
          `${config.PUBLIC_URL}${Routes.HealowCallback}`,
          healowId || undefined,
          userPreferences.use_proxy,
        )
          .then((res) => {
            if (
              res.access_token &&
              res.expires_in &&
              res.id_token &&
              user.id &&
              healowId
            ) {
              const nowInSeconds = Math.floor(Date.now() / 1000);
              const dbentry: CreateHealowConnectionDocument = {
                id: uuid4(),
                user_id: user.id,
                source: 'healow',
                location: healowUrl,
                name: healowName,
                access_token: res.access_token,
                scope: res.scope,
                id_token: res.id_token,
                refresh_token: res.refresh_token,
                expires_at: nowInSeconds + res.expires_in,
                auth_uri: healowAuthUrl,
                token_uri: healowTokenUrl,
                tenant_id: healowId,
              };
              createConnection(db, dbentry as any)
                .then(() => {
                  localStorage.removeItem(
                    HealowLocalStorageKeys.HEALOW_BASE_URL,
                  );
                  localStorage.removeItem(HealowLocalStorageKeys.HEALOW_NAME);
                  localStorage.removeItem(
                    HealowLocalStorageKeys.HEALOW_AUTH_URL,
                  );
                  localStorage.removeItem(
                    HealowLocalStorageKeys.HEALOW_TOKEN_URL,
                  );
                  localStorage.removeItem(HealowLocalStorageKeys.HEALOW_ID);
                  sessionStorage.removeItem('healow_code_verifier');
                  sessionStorage.removeItem('healow_oauth2_state');
                  navigate(Routes.AddConnection);
                })
                .catch((e: unknown) => {
                  localStorage.removeItem(
                    HealowLocalStorageKeys.HEALOW_BASE_URL,
                  );
                  localStorage.removeItem(HealowLocalStorageKeys.HEALOW_NAME);
                  localStorage.removeItem(
                    HealowLocalStorageKeys.HEALOW_AUTH_URL,
                  );
                  localStorage.removeItem(
                    HealowLocalStorageKeys.HEALOW_TOKEN_URL,
                  );
                  localStorage.removeItem(HealowLocalStorageKeys.HEALOW_ID);
                  notifyDispatch({
                    type: 'set_notification',
                    message: `Error adding connection: ${(e as Error).message}`,
                    variant: 'error',
                  });
                  navigate(Routes.AddConnection);
                });
            } else {
              notifyDispatch({
                type: 'set_notification',
                message: `Error completing authentication: no access token provided`,
                variant: 'error',
              });
            }
          })
          .catch((e) => {
            notifyDispatch({
              type: 'set_notification',
              message: `Error adding connection: ${(e as Error).message}`,
              variant: 'error',
            });
            navigate(Routes.AddConnection);
          });
      } else {
        notifyDispatch({
          type: 'set_notification',
          message: `Error adding connection: missing required parameters`,
          variant: 'error',
        });
        console.error('Missing required parameters');
        const missingParams = [
          !code ? 'code' : '',
          !healowUrl ? 'healowUrl' : '',
          !healowName ? 'healowName' : '',
          !healowAuthUrl ? 'healowAuthUrl' : '',
          !healowTokenUrl ? 'healowTokenUrl' : '',
        ]
          .filter((x) => x)
          .join(', ');
        setError(
          `There was a problem trying to sign in: Missing parameters: ${missingParams}`,
        );
      }
    }
  }, [db, config, userPreferences, navigate, notifyDispatch, search, user.id]);

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

export default HealowRedirect;
