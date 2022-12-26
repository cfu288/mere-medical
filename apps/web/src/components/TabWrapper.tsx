import {
  Cog6ToothIcon,
  NewspaperIcon,
  PlusCircleIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';
import ConnectionTab from '../pages/ConnectionTab';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import TimelineTab from '../pages/TimelineTab';
import { Routes as AppRoutes } from '../Routes';
import SummaryTab from '../pages/SummaryTab';
import SettingsTab from '../pages/SettingsTab';
import EpicRedirect from '../pages/EpicRedirect';
import logo from '../img/logo.svg';
import { TabButton } from './TabButton';

export function TabWrapper() {
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
