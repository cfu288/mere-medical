import '../theme/fonts.css';
import '../styles.css';

import { BrowserRouter as Router } from 'react-router-dom';
import { UserProvider } from '../components/providers/UserProvider';
import { NotificationProvider } from '../components/providers/NotificationProvider';
import { TabWrapper } from '../components/TabWrapper';
import { RxDbProvider } from '../components/providers/RxDbProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { UserPreferencesProvider } from '../components/providers/UserPreferencesProvider';
import { SyncJobProvider } from '../components/providers/SyncJobProvider';
import { LocalConfigProvider } from '../components/providers/LocalConfigProvider';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import Config from '../environments/config.json';
import { useConsoleLogEasterEgg } from '../components/hooks/useConsoleLogEasterEgg';

export default function App() {
  useConsoleLogEasterEgg();

  return (
    <ErrorBoundary>
      <LocalConfigProvider>
        {Config.IS_DEMO !== 'enabled' && <TutorialOverlay />}
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
