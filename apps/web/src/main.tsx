import * as ReactDOM from 'react-dom/client';
import App from './app/App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import * as Sentry from '@sentry/react';
import Config from './environments/config.json';

if (Config.SENTRY_WEB_DSN) {
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

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<App />);

serviceWorkerRegistration.register();
