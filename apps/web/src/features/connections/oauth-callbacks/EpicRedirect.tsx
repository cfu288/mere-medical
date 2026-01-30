import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppPage } from '../../../shared/components/AppPage';
import { GenericBanner } from '../../../shared/components/GenericBanner';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { Routes } from '../../../Routes';
import { useAppConfig } from '../../../app/providers/AppConfigProvider';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { useUserPreferences } from '../../../app/providers/UserPreferencesProvider';
import { useUser } from '../../../app/providers/UserProvider';
import {
  createEpicClient,
  createEpicClientWithProxy,
  registerEpicDynamicClient,
  buildEpicOAuthConfig,
  EPIC_DEFAULT_SCOPES,
  type EpicTokenSet,
  OAuthError,
} from '@mere/fhir-oauth';
import { signJwt, getPublicKey } from '@mere/crypto/browser';
import { useOAuthFlow } from '@mere/fhir-oauth/react';
import {
  EpicLocalStorageKeys,
  getEpicClientId,
  getDSTU2Url,
  getR4Url,
  saveConnectionToDb,
} from '../../../services/fhir/Epic';
import { isEpicSandbox } from '../../../services/fhir/EpicUtils';

const epicClient = createEpicClient({ signJwt });

const createProxiedEpicClient = (publicUrl: string) =>
  createEpicClientWithProxy(
    { signJwt },
    (tenantId, targetType) =>
      `${publicUrl}/api/proxy?serviceId=${tenantId}&target_type=${targetType}`,
  );

/**
 * Handles the redirect from Epic's authorization server. If possible, it
 * will attempt to register a dynamic client so we can automatically refresh
 * tokens in the future. If that fails, it will attempt to use the access
 * token provided by Epic to pull FHIR resources once and we will need the
 * user to manually re-sign in every time they want to manually pull their
 * records.
 *
 * Ideally, we would use the conformance statement to determine whether or
 * not we can register a dynamic client, but Epic's conformance statement at
 * `api/FHIR/DSTU2/metadata` at `rest.security.extensions` is mostly inaccurate
 * anyways so we can't tell.
 */
function useEpicOAuthCallback() {
  const db = useRxDb();
  const { config, isLoading: configLoading } = useAppConfig();
  const user = useUser();
  const userPreferences = useUserPreferences();
  const navigate = useNavigate();
  const notifyDispatch = useNotificationDispatch();
  const { search } = useLocation();
  const hasRun = useRef(false);
  const [error, setError] = useState('');

  const enableProxy = userPreferences?.use_proxy ?? false;
  const publicUrl = config.PUBLIC_URL || '';
  const client = enableProxy ? createProxiedEpicClient(publicUrl) : epicClient;
  const { handleCallback, clearSession } = useOAuthFlow({
    client,
    vendor: 'epic',
  });

  useEffect(() => {
    if (configLoading || !userPreferences || hasRun.current) return;

    const searchParams = new URLSearchParams(search);
    const epicBaseUrl = localStorage.getItem(
      EpicLocalStorageKeys.EPIC_BASE_URL,
    );
    const epicTokenUrl = localStorage.getItem(
      EpicLocalStorageKeys.EPIC_TOKEN_URL,
    );
    const epicAuthUrl = localStorage.getItem(
      EpicLocalStorageKeys.EPIC_AUTH_URL,
    );
    const epicName = localStorage.getItem(EpicLocalStorageKeys.EPIC_NAME);
    const epicId = localStorage.getItem(EpicLocalStorageKeys.EPIC_ID);
    const storedFhirVersion = localStorage.getItem(
      EpicLocalStorageKeys.FHIR_VERSION,
    ) as 'DSTU2' | 'R4' | null;

    if (
      !epicBaseUrl ||
      !epicTokenUrl ||
      !epicAuthUrl ||
      !epicName ||
      !epicId ||
      !user
    ) {
      hasRun.current = true;
      clearLocalStorage();
      clearSession();
      const missingParams = [
        !epicBaseUrl && 'epicBaseUrl',
        !epicTokenUrl && 'epicTokenUrl',
        !epicAuthUrl && 'epicAuthUrl',
        !epicName && 'epicName',
        !epicId && 'epicId',
        !user && 'user',
      ]
        .filter(Boolean)
        .join(', ');
      setError(`Missing required parameters: ${missingParams}`);
      return;
    }

    hasRun.current = true;
    const fhirVersion =
      storedFhirVersion ||
      (epicBaseUrl.toUpperCase().includes('/R4') ? 'R4' : 'DSTU2');
    const fhirBaseUrl =
      fhirVersion === 'R4' ? getR4Url(epicBaseUrl) : getDSTU2Url(epicBaseUrl);
    const isSandbox = isEpicSandbox(epicId);
    const clientId = getEpicClientId(config, fhirVersion, isSandbox);

    if (!clientId || !config.PUBLIC_URL) {
      clearLocalStorage();
      clearSession();
      setError('Epic OAuth configuration is incomplete');
      return;
    }

    const oauthConfig = buildEpicOAuthConfig({
      clientId,
      publicUrl: config.PUBLIC_URL,
      redirectPath: Routes.EpicCallback,
      scopes: EPIC_DEFAULT_SCOPES,
      tenant: {
        id: epicId,
        name: epicName,
        authUrl: epicAuthUrl,
        tokenUrl: epicTokenUrl,
        fhirBaseUrl,
        fhirVersion,
      },
    });

    (async () => {
      try {
        const tokens = await handleCallback(searchParams, oauthConfig);

        let finalTokens: EpicTokenSet = tokens;
        let dynamicClientId: string | undefined;

        try {
          const publicKey = await getPublicKey();
          const proxyUrl = enableProxy
            ? `${publicUrl}/api/proxy?serviceId=${epicId}&target_type=register`
            : undefined;

          const dcr = await registerEpicDynamicClient(
            tokens.accessToken,
            epicBaseUrl,
            oauthConfig.clientId,
            publicKey,
            { useProxy: enableProxy, proxyUrl },
          );
          dynamicClientId = dcr.clientId;

          try {
            finalTokens = await client.refresh(
              { ...tokens, clientId: dynamicClientId },
              oauthConfig,
            );
          } catch (refreshError) {
            notifyDispatch({
              type: 'set_notification',
              message:
                'Token refresh failed. You may need to sign in again to sync records in the future.',
              variant: 'info',
            });
            dynamicClientId = undefined;
          }
        } catch (dcrError) {
          if (
            dcrError instanceof OAuthError &&
            dcrError.code === 'dcr_not_supported'
          ) {
            notifyDispatch({
              type: 'set_notification',
              message:
                'This MyChart instance does not support automatic token refresh. You will need to sign in again to sync records in the future.',
              variant: 'info',
            });
          } else {
            notifyDispatch({
              type: 'set_notification',
              message:
                'Dynamic client registration failed. You may need to sign in again to sync records in the future.',
              variant: 'info',
            });
          }
        }

        await saveConnectionToDb({
          res: {
            access_token: finalTokens.accessToken,
            expires_in: finalTokens.expiresAt - Math.floor(Date.now() / 1000),
            patient: finalTokens.patientId || '',
            token_type: 'Bearer',
            scope: (finalTokens.raw['scope'] as string) || '',
            refresh_token: finalTokens.refreshToken || '',
            ...(dynamicClientId && { client_id: dynamicClientId }),
          },
          epicBaseUrl,
          epicTokenUrl,
          epicAuthUrl,
          epicName,
          db,
          epicId,
          user,
          fhirVersion,
        });

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
    publicUrl,
    db,
    user,
    userPreferences,
    enableProxy,
    client,
    handleCallback,
    clearSession,
    navigate,
    notifyDispatch,
    search,
  ]);

  return error;
}

function clearLocalStorage() {
  Object.values(EpicLocalStorageKeys).forEach((key) =>
    localStorage.removeItem(key),
  );
}

const EpicRedirect: React.FC = () => {
  const navigate = useNavigate();
  const error = useEpicOAuthCallback();

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
