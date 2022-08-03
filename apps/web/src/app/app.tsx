import '../theme/ionic.css';
import '../theme/tailwind.css';

import { ellipse, triangle } from 'ionicons/icons';
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

import { PouchDbProvider } from '../components/PouchDbProvider';
import ConnectionTab from '../pages/ConnectionTab';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import TimelineTab from '../pages/TimelineTab';
import { Routes as AppRoutes } from '../Routes';

setupIonicReact();

const App: React.FC = () => {
  return (
    <PouchDbProvider>
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
              <Route exact path="/onpatient/redirect">
                <OnPatientRedirect />
              </Route>
              <Route exact path="/">
                <Redirect to={AppRoutes.Timeline} />
              </Route>
            </IonRouterOutlet>
            <IonTabBar slot="bottom">
              <IonTabButton tab="timeline" href={AppRoutes.Timeline}>
                <IonIcon icon={triangle} />
                <IonLabel>Timeline</IonLabel>
              </IonTabButton>
              <IonTabButton tab="add" href={AppRoutes.AddConnection}>
                <IonIcon icon={ellipse} />
                <IonLabel>Add</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
        </IonReactRouter>
      </IonApp>
    </PouchDbProvider>
  );
};

export default App;
