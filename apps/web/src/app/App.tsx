import '../theme/fonts.css';
import '../theme/tailwind.css';

import { BrowserRouter as Router } from 'react-router-dom';
import { UserProvider } from '../components/providers/UserProvider';
import { NotificationProvider } from '../components/providers/NotificationProvider';
import { TabWrapper } from '../components/TabWrapper';
import { RxDbProvider } from '../components/providers/RxDbProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { UserPreferencesProvider } from '../components/providers/UserPreferencesProvider';

export default function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <RxDbProvider>
          <UserProvider>
            <UserPreferencesProvider>
              <Router>
                <TabWrapper />
              </Router>
            </UserPreferencesProvider>
          </UserProvider>
        </RxDbProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}
