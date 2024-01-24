import { useLocalConfig } from '../../components/providers/LocalConfigProvider';
import Config from '../../environments/config.json';
import * as Sentry from '@sentry/react';
import { useCallback, useEffect } from 'react';

// Initialize Sentry
if (Sentry?.getCurrentHub()?.getClient() === undefined) {
  if (Config.IS_DEMO === 'enabled') {
    console.debug('Sentry: Demo mode, disabled');
  } else if (
    Config.SENTRY_WEB_DSN &&
    Config.SENTRY_WEB_DSN.includes('SENTRY_WEB_DSN') === false
  ) {
    console.debug('Sentry: DSN provided, enabled');
    Sentry.init({
      dsn: Config.SENTRY_WEB_DSN,
      transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
      integrations: [
        new Sentry.BrowserTracing({
          // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
          tracePropagationTargets: [
            'localhost',
            /^https:\/\/app\.meremedical\.co/,
          ],
        }),
        new Sentry.Replay({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    });
  }
}

export function SentryInitializer({
  children,
}: {
  children?: React.ReactNode;
}) {
  useSentryLogging();

  return <>{children}</>;
}

function useSentryLogging() {
  const localConfig = useLocalConfig();

  const toggleSentryReporting = useCallback((enabled: boolean) => {
    const sentryClient = Sentry.getCurrentHub().getClient();
    if (sentryClient) {
      sentryClient.getOptions().enabled = enabled;
      console.log(
        `Sentry: ${
          sentryClient.getOptions().enabled ? 'Enabling' : 'Disabling'
        } reporting`,
      );
    }
  }, []);

  useEffect(() => {
    if (localConfig?.use_sentry_reporting === true) {
      toggleSentryReporting(true);
    } else {
      toggleSentryReporting(false);
    }
  }, [localConfig?.use_sentry_reporting, toggleSentryReporting]);
}
