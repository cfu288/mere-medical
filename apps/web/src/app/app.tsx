import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import '../theme/variables.css';

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

import { ellipse, triangle } from 'ionicons/icons';

import React from 'react';
import { PouchDbProvider } from '../components/PouchDbProvider';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import { Routes as AppRoutes } from '../Routes';
import ConnectionTab from '../pages/ConnectionTab';
import TimelineTab from '../pages/TimelineTab';

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
