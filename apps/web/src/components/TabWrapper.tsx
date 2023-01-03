import {
  Cog6ToothIcon,
  NewspaperIcon,
  PlusCircleIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import ConnectionTab from '../pages/ConnectionTab';
import OnPatientRedirect from '../pages/OnPatientRedirect';
import TimelineTab from '../pages/TimelineTab';
import { Routes as AppRoutes } from '../Routes';
import SummaryTab from '../pages/SummaryTab';
import SettingsTab from '../pages/SettingsTab';
import EpicRedirect from '../pages/EpicRedirect';
import logo from '../img/white-logo.svg';
import { TabButton } from './TabButton';
import { useUser } from './UserProvider';

export function TabWrapper() {
  const user = useUser();

  return (
    <div className="mobile-full-height flex md:flex-row-reverse">
      <div className="flex-grow">
        <Routes>
          <Route path={AppRoutes.Timeline} element={<TimelineTab />} />
          <Route path={AppRoutes.AddConnection} element={<ConnectionTab />} />
          <Route path={AppRoutes.Summary} element={<SummaryTab />} />
          <Route path={AppRoutes.Settings} element={<SettingsTab />} />
          <Route
            path={AppRoutes.OnPatientCallback}
            element={<OnPatientRedirect />}
          />
          <Route path={AppRoutes.EpicCallback} element={<EpicRedirect />} />
          <Route path="*" element={<Navigate to={AppRoutes.Timeline} />} />
        </Routes>
      </div>
      <div className="flex-0 md:bg-primary-800 absolute bottom-0 left-0 z-20 w-full bg-slate-50 md:relative md:bottom-auto md:top-0 md:h-full md:w-auto">
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
          <div className="hidden md:block md:flex-1"></div>
          <div className="border-primary-700 hidden flex-shrink-0 border-t p-4 md:block">
            <div className="group block flex-shrink-0">
              <div className="flex items-center">
                <div className="inline-block h-10 w-10 rounded-full border-2 border-white bg-slate-100">
                  <svg
                    className="h-full w-full rounded-full text-gray-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-base font-medium text-white">
                    {user?.first_name
                      ? `${user.first_name} ${user.last_name}`
                      : 'Unknown User'}
                  </p>
                  <Link
                    to={AppRoutes.Settings}
                    className="text-sm font-medium text-indigo-200 group-hover:text-white"
                  >
                    {user?.first_name ? 'View details' : 'Add User Details'}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
