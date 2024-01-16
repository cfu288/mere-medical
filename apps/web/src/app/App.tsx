import '../theme/fonts.css';
import '../styles.css';

import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { useConsoleLogEasterEgg } from '../components/hooks/useConsoleLogEasterEgg';
import { DeveloperLogsProvider } from '../components/providers/DeveloperLogsProvider';
import { LocalConfigProvider } from '../components/providers/LocalConfigProvider';
import { NotificationProvider } from '../components/providers/NotificationProvider';
import { RxDbProvider } from '../components/providers/RxDbProvider';
import { SentryInitializer } from '../components/providers/SentryInitializer';
import { SyncJobProvider } from '../components/providers/SyncJobProvider';
import { TutorialConfigProvider } from '../components/providers/TutorialConfigProvider';
import { UpdateAppChecker } from '../components/providers/UpdateAppChecker';
import { UserPreferencesProvider } from '../components/providers/UserPreferencesProvider';
import { UserProvider } from '../components/providers/UserProvider';
import { TabWrapper } from '../components/TabWrapper';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import Config from '../environments/config.json';
import CernerRedirect from '../pages/CernerRedirect';
import ConnectionTab from '../pages/ConnectionTab';
import EpicRedirect from '../pages/EpicRedirect';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import SettingsTab from '../pages/SettingsTab';
import SummaryTab from '../pages/SummaryTab';
import { TimelineTab } from '../pages/TimelineTab';
import VARedirect from '../pages/VARedirect';
import VeradigmRedirect from '../pages/VeradigmRedirect';
import { Routes as AppRoutes } from '../Routes';

export default function App() {
  useConsoleLogEasterEgg();

  return (
    <ErrorBoundary>
      <LocalConfigProvider>
        <DeveloperLogsProvider>
          <TutorialConfigProvider>
            {Config.IS_DEMO !== 'enabled' && <TutorialOverlay />}
          </TutorialConfigProvider>
          <SentryInitializer />
          <NotificationProvider>
            <UpdateAppChecker />
            <RxDbProvider>
              <UserProvider>
                <UserPreferencesProvider>
                  <SyncJobProvider>
                    <RouterProvider router={router} />
                  </SyncJobProvider>
                </UserPreferencesProvider>
              </UserProvider>
            </RxDbProvider>
          </NotificationProvider>
        </DeveloperLogsProvider>
      </LocalConfigProvider>
    </ErrorBoundary>
  );
}

const router = createBrowserRouter([
  {
    element: <TabWrapper />,
    children: [
      {
        path: AppRoutes.Timeline,
        element: <TimelineTab />,
      },
      {
        path: AppRoutes.AddConnection,
        element: <ConnectionTab />,
      },
      {
        path: AppRoutes.Summary,
        element: <SummaryTab />,
      },
      {
        path: AppRoutes.Settings,
        element: <SettingsTab />,
      },
      {
        path: AppRoutes.OnPatientCallback,
        element: <OnPatientRedirect />,
      },
      {
        path: AppRoutes.EpicCallback,
        element: <EpicRedirect />,
      },
      {
        path: AppRoutes.CernerCallback,
        element: <CernerRedirect />,
      },
      {
        path: AppRoutes.VeradigmCallback,
        element: <VeradigmRedirect />,
      },
      {
        path: AppRoutes.VACallback,
        element: <VARedirect />,
      },
      {
        path: '*',
        element: <Navigate to={AppRoutes.Timeline} />,
      },
    ],
  },
]);
