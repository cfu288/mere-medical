import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { Routes } from '../../../Routes';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { AppPage } from '../../../shared/components/AppPage';
import { GenericBanner } from '../../../shared/components/GenericBanner';
import { useUser } from '../../../app/providers/UserProvider';
import { useAppConfig } from '../../../app/providers/AppConfigProvider';
import { useUserPreferences } from '../../../app/providers/UserPreferencesProvider';
import {
  HealowLocalStorageKeys,
  saveConnectionToDb,
} from '../../../services/fhir/Healow';
import { concatPath } from '../../../shared/utils/urlUtils';
import { createHealowClient, buildHealowOAuthConfig } from '@mere/fhir-oauth';
import { useOAuthFlow } from '@mere/fhir-oauth/react';

function clearLocalStorage() {
  Object.values(HealowLocalStorageKeys).forEach((key) =>
    localStorage.removeItem(key),
  );
}

function buildHealowProxyUrlBuilder(publicUrl: string) {
  return (tenantId: string, targetType: 'token' | 'base') =>
    concatPath(
      publicUrl,
      `/api/proxy?vendor=healow&serviceId=${tenantId}&target_type=${targetType}`,
    );
}

function useHealowOAuthCallback() {
  const navigate = useNavigate();
  const user = useUser();
  const db = useRxDb();
  const { config, isLoading } = useAppConfig();
  const userPreferences = useUserPreferences();
  const notifyDispatch = useNotificationDispatch();
  const hasRun = useRef(false);
  const { search } = useLocation();

  const confidentialMode = config.HEALOW_CONFIDENTIAL_MODE || false;
  const publicUrl = config.PUBLIC_URL || '';
  const useProxy = userPreferences?.use_proxy ?? false;

  const client = useMemo(
    () =>
      createHealowClient({
        mode: confidentialMode ? 'confidential' : 'public',
        apiEndpoints: {
          token: concatPath(publicUrl, '/api/v1/healow/token'),
          refresh: concatPath(publicUrl, '/api/v1/healow/refresh'),
        },
        proxyUrlBuilder: useProxy
          ? buildHealowProxyUrlBuilder(publicUrl)
          : undefined,
      }),
    [confidentialMode, publicUrl, useProxy],
  );

  const { handleCallback, clearSession } = useOAuthFlow({
    client,
    vendor: 'healow',
  });

  useEffect(() => {
    if (isLoading || userPreferences === undefined || hasRun.current) return;

    const searchParams = new URLSearchParams(search);
    const errorMsg = searchParams.get('error');
    const errorMsgDescription = searchParams.get('error_description');
    const healowUrl = localStorage.getItem(
      HealowLocalStorageKeys.HEALOW_BASE_URL,
    );
    const healowName = localStorage.getItem(HealowLocalStorageKeys.HEALOW_NAME);
    const healowAuthUrl = localStorage.getItem(
      HealowLocalStorageKeys.HEALOW_AUTH_URL,
    );
    const healowTokenUrl = localStorage.getItem(
      HealowLocalStorageKeys.HEALOW_TOKEN_URL,
    );
    const healowId = localStorage.getItem(HealowLocalStorageKeys.HEALOW_ID);

    if (errorMsg) {
      hasRun.current = true;
      clearLocalStorage();
      clearSession();
      notifyDispatch({
        type: 'set_notification',
        message: `${errorMsg}: ${errorMsgDescription || 'Unknown error'}`,
        variant: 'error',
      });
      navigate(Routes.AddConnection);
      return;
    }

    if (
      !healowUrl ||
      !healowName ||
      !healowAuthUrl ||
      !healowTokenUrl ||
      !healowId ||
      !user?.id
    ) {
      hasRun.current = true;
      clearLocalStorage();
      clearSession();
      notifyDispatch({
        type: 'set_notification',
        message: `Error adding connection: missing required parameters`,
        variant: 'error',
      });
      navigate(Routes.AddConnection);
      return;
    }

    if (!config.HEALOW_CLIENT_ID || !config.PUBLIC_URL) {
      hasRun.current = true;
      clearLocalStorage();
      clearSession();
      notifyDispatch({
        type: 'set_notification',
        message: 'Healow OAuth configuration is incomplete',
        variant: 'error',
      });
      navigate(Routes.AddConnection);
      return;
    }

    hasRun.current = true;

    const oauthConfig = buildHealowOAuthConfig({
      clientId: config.HEALOW_CLIENT_ID,
      publicUrl,
      redirectPath: Routes.HealowCallback,
      confidentialMode,
      tenant: {
        id: healowId,
        name: healowName,
        authUrl: healowAuthUrl,
        tokenUrl: healowTokenUrl,
        fhirBaseUrl: healowUrl,
      },
    });

    (async () => {
      try {
        const tokens = await handleCallback(searchParams, oauthConfig);

        if (!tokens.accessToken || !tokens.expiresAt) {
          notifyDispatch({
            type: 'set_notification',
            message:
              'Error completing authentication: no access token provided',
            variant: 'error',
          });
          navigate(Routes.AddConnection);
          return;
        }

        await saveConnectionToDb({
          tokens,
          healowBaseUrl: healowUrl,
          healowName,
          healowAuthUrl,
          healowTokenUrl,
          healowId,
          db,
          user,
        });

        navigate(Routes.AddConnection);
      } catch (e) {
        notifyDispatch({
          type: 'set_notification',
          message: `Error adding connection: ${(e as Error).message}`,
          variant: 'error',
        });
        navigate(Routes.AddConnection);
      } finally {
        clearLocalStorage();
      }
    })();
  }, [
    db,
    config,
    isLoading,
    publicUrl,
    confidentialMode,
    userPreferences,
    handleCallback,
    clearSession,
    navigate,
    notifyDispatch,
    search,
    user,
  ]);
}

const HealowRedirect: React.FC = () => {
  useHealowOAuthCallback();

  return (
    <AppPage banner={<GenericBanner text="Authenticated! Redirecting" />}>
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
    </AppPage>
  );
};

export default HealowRedirect;
