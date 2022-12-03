import '../theme/ionic.css';
import '../theme/tailwind.css';

import {
  newspaperOutline,
  analyticsOutline,
  addCircleOutline,
  settingsOutline,
} from 'ionicons/icons';
import React from 'react';
import { Redirect, Route } from 'react-router-dom';

import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import { RxDbProvider } from '../components/RxDbProvider';
import ConnectionTab from '../pages/ConnectionTab';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import TimelineTab from '../pages/TimelineTab';
import { Routes as AppRoutes } from '../Routes';
import SummaryTab from '../pages/SummaryTab';
import SettingsTab from '../pages/SettingsTab';
import { UserProvider } from '../components/UserProvider';
import EpicRedirect from '../pages/EpicRedirect';

setupIonicReact();

const App: React.FC = () => {
  return (
    <RxDbProvider>
      <UserProvider>
        <IonApp>
          <IonReactRouter>
            <IonTabs>
              <IonRouterOutlet>
                <Route exact path={AppRoutes.Timeline}>
                  <TimelineTab />
                </Route>
                <Route exact path={AppRoutes.AddConnection}>
                  <ConnectionTab />
                </Route>
                <Route exact path={AppRoutes.Summary}>
                  <SummaryTab />
                </Route>
                <Route exact path={AppRoutes.Settings}>
                  <SettingsTab />
                </Route>
                <Route exact path={AppRoutes.OnPatientCallback}>
                  <OnPatientRedirect />
                </Route>
                <Route exact path={AppRoutes.EpicCallback}>
                  <EpicRedirect />
                </Route>
                <Route exact path="/">
                  <Redirect to={AppRoutes.Timeline} />
                </Route>
              </IonRouterOutlet>
              <IonTabBar slot="bottom" className="pb-4 sm:pb-0">
                <IonTabButton tab="timeline" href={AppRoutes.Timeline}>
                  <IonIcon icon={newspaperOutline} />
                  <IonLabel>Timeline</IonLabel>
                </IonTabButton>
                <IonTabButton tab="summary" href={AppRoutes.Summary}>
                  <IonIcon icon={analyticsOutline} />
                  <IonLabel>Summary</IonLabel>
                </IonTabButton>
                <IonTabButton tab="add" href={AppRoutes.AddConnection}>
                  <IonIcon icon={addCircleOutline} />
                  <IonLabel>Add</IonLabel>
                </IonTabButton>
                <IonTabButton tab="settings" href={AppRoutes.Settings}>
                  <IonIcon icon={settingsOutline} />
                  <IonLabel>Settings</IonLabel>
                </IonTabButton>
              </IonTabBar>
            </IonTabs>
          </IonReactRouter>
        </IonApp>
      </UserProvider>
    </RxDbProvider>
  );
};

export default App;
