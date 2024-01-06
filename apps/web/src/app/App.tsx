import '../theme/fonts.css';
import '../styles.css';

import { BrowserRouter as Router } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { useConsoleLogEasterEgg } from '../components/hooks/useConsoleLogEasterEgg';
import { LocalConfigProvider } from '../components/providers/LocalConfigProvider';
import { NotificationProvider } from '../components/providers/NotificationProvider';
import { RxDbProvider } from '../components/providers/RxDbProvider';
import { SentryInitializer } from '../components/providers/SentryInitializer';
import { SyncJobProvider } from '../components/providers/SyncJobProvider';
import { UserPreferencesProvider } from '../components/providers/UserPreferencesProvider';
import { UserProvider } from '../components/providers/UserProvider';
import { TabWrapper } from '../components/TabWrapper';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import Config from '../environments/config.json';
import { TutorialConfigProvider } from '../components/providers/TutorialConfigProvider';

export default function App() {
  useConsoleLogEasterEgg();

  return (
    <ErrorBoundary>
      <LocalConfigProvider>
        <TutorialConfigProvider>
          {Config.IS_DEMO !== 'enabled' && <TutorialOverlay />}
        </TutorialConfigProvider>
        <SentryInitializer />
        <NotificationProvider>
          <RxDbProvider>
            <UserProvider>
              <UserPreferencesProvider>
                <Router>
                  <SyncJobProvider>
                    <TabWrapper />
                  </SyncJobProvider>
                </Router>
              </UserPreferencesProvider>
            </UserProvider>
          </RxDbProvider>
        </NotificationProvider>
      </LocalConfigProvider>
    </ErrorBoundary>
  );
}
