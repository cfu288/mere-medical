import '../styles.css';

import React from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';

import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { useConsoleLogEasterEgg } from '../shared/hooks/useConsoleLogEasterEgg';
import { DeveloperLogsProvider } from '../app/providers/DeveloperLogsProvider';
import { LocalConfigProvider } from '../app/providers/LocalConfigProvider';
import { NotificationProvider } from '../app/providers/NotificationProvider';
import { RxDbProvider } from '../app/providers/RxDbProvider';
import { SyncJobProvider } from '../features/sync/SyncJobProvider';
import { TutorialConfigProvider } from '../features/tutorial/TutorialConfigProvider';
import { UpdateAppChecker } from '../app/providers/UpdateAppChecker';
import { UserPreferencesProvider } from '../app/providers/UserPreferencesProvider';
import { UserProvider } from '../app/providers/UserProvider';
import VectorProvider from '../features/vectors';
import { AppConfigProvider } from '../app/providers/AppConfigProvider';
import { TabWrapper } from '../shared/components/TabWrapper';
import { TutorialOverlay } from '../features/tutorial/TutorialOverlay';
import AthenaRedirect from '../features/connections/oauth-callbacks/AthenaRedirect';
import CernerRedirect from '../features/connections/oauth-callbacks/CernerRedirect';
import ConnectionTab from '../features/connections/ConnectionTab';
import EpicRedirect from '../features/connections/oauth-callbacks/EpicRedirect';
import HealowRedirect from '../features/connections/oauth-callbacks/HealowRedirect';
import MereAITab from '../features/ai-chat/MereAITab';
import OnPatientRedirect from '../features/connections/oauth-callbacks/OnPatientRedirect';
import SettingsTab from '../features/settings/SettingsTab';
import SummaryTab from '../features/summary/SummaryTab';
import { TimelineTab } from '../features/timeline/TimelineTab';
import VARedirect from '../features/connections/oauth-callbacks/VARedirect';
import VeradigmRedirect from '../features/connections/oauth-callbacks/VeradigmRedirect';
import { Routes as AppRoutes } from '../Routes';

export default function App() {
  useConsoleLogEasterEgg();

  return (
    <ErrorBoundary>
      <LocalConfigProvider>
        <DeveloperLogsProvider>
          <TutorialConfigProvider>
            {IS_DEMO !== 'enabled' && <TutorialOverlay />}
          </TutorialConfigProvider>
          <NotificationProvider>
            <UpdateAppChecker />
            <RxDbProvider>
              <AppConfigProvider>
                <UserProvider>
                  <VectorProvider>
                    <UserPreferencesProvider>
                      <SyncJobProvider>
                        <RouterProvider router={router} />
                      </SyncJobProvider>
                    </UserPreferencesProvider>
                  </VectorProvider>
                </UserProvider>
              </AppConfigProvider>
            </RxDbProvider>
          </NotificationProvider>
        </DeveloperLogsProvider>
      </LocalConfigProvider>
    </ErrorBoundary>
  );
}

const routes = [
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
        path: AppRoutes.MereAIAssistant,
        element: <MereAITab />,
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
        path: AppRoutes.HealowCallback,
        element: <HealowRedirect />,
      },
      {
        path: AppRoutes.AthenaCallback,
        element: <AthenaRedirect />,
      },
      {
        path: '*',
        element: <Navigate to={AppRoutes.Timeline} />,
      },
    ],
  },
];

const router = createBrowserRouter(routes);
