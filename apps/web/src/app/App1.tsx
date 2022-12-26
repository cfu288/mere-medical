import '../theme/fonts.css';
import '../theme/tailwind.css';

import {
  Cog6ToothIcon,
  NewspaperIcon,
  PlusCircleIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  Redirect,
  useLocation,
} from 'react-router-dom';
import { RxDbProvider } from '../components/RxDbProvider';
import ConnectionTab from '../pages/ConnectionTab';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import TimelineTab from '../pages/TimelineTab';
import { Routes as AppRoutes } from '../Routes';
import SummaryTab from '../pages/SummaryTab';
import SettingsTab from '../pages/SettingsTab';
import { UserProvider } from '../components/UserProvider';
import EpicRedirect from '../pages/EpicRedirect';
import { NotificationProvider } from '../services/NotificationContext';
import logo from '../img/logo.svg';

function TabButton({
  route,
  title,
  icon,
}: {
  route: AppRoutes;
  title: string;
  icon: JSX.Element;
}) {
  const location = useLocation()?.pathname;

  return (
    <Link
      to={route}
      className={`flex w-24 flex-col items-center justify-center p-2 pb-3 md:m-1 md:w-auto md:flex-row md:justify-start md:rounded-md md:p-4 md:pb-2 ${
        location === route
          ? 'border-primary bg-gray-0 border-t-2 md:border-t-0 md:bg-gray-200'
          : ''
      }`}
    >
      <>
        <p
          className={`font-xs h-6 w-6 md:mr-4 md:h-8 md:w-8 ${
            location === route ? 'text-primary-700' : 'text-gray-800'
          }`}
        >
          {icon}
        </p>
        <p
          className={`font-xs ${
            location === route ? 'text-primary-700' : 'text-gray-800'
          }`}
        >
          {title}
        </p>
      </>
    </Link>
  );
}

function TabWrapper() {
  return (
    <div className="flex h-screen max-h-screen md:flex-row-reverse">
      <div className="flex-grow">
        <Switch>
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
        </Switch>
      </div>
      <div className="flex-0 absolute bottom-0 left-0 z-30 w-full bg-slate-50 md:relative md:bottom-auto md:top-0 md:h-full md:w-auto md:border-r-2">
        <div className="mx-auto flex w-full max-w-3xl justify-around md:h-full md:w-64 md:flex-col md:justify-start">
          <img
            src={logo}
            className="hidden h-20 w-20 p-4 md:block"
            alt="logo"
          ></img>
          <TabButton
            route={AppRoutes.Timeline}
            title="Timeline"
            icon={<NewspaperIcon />}
          />
          <TabButton
            route={AppRoutes.Summary}
            title="Summary"
            icon={<QueueListIcon />}
          />
          <TabButton
            route={AppRoutes.AddConnection}
            title="Connections"
            icon={<PlusCircleIcon />}
          />
          <TabButton
            route={AppRoutes.Settings}
            title="Settings"
            icon={<Cog6ToothIcon />}
          />
        </div>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <RxDbProvider>
        <UserProvider>
          <Router>
            <TabWrapper />
          </Router>
        </UserProvider>
      </RxDbProvider>
    </NotificationProvider>
  );
};

export default App;
