import '../theme/fonts.css';
import '../theme/tailwind.css';

import { BrowserRouter as Router } from 'react-router-dom';
import { UserProvider } from '../components/UserProvider';
import { NotificationProvider } from '../services/NotificationContext';
import { TabWrapper } from '../components/TabWrapper';
import { RxDbProvider } from '../components/RxDbProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <RxDbProvider>
          <UserProvider>
            <Router>
              <TabWrapper />
            </Router>
          </UserProvider>
        </RxDbProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}
