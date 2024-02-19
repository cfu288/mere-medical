import { Link, Outlet } from 'react-router-dom';

import {
  Cog6ToothIcon,
  NewspaperIcon,
  PlusCircleIcon,
  QueueListIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

import logo from '../assets/img/white-logo.svg';
import { Routes as AppRoutes } from '../Routes';
import { useUser } from './providers/UserProvider';
import { TabButton } from './TabButton';
import { useLocalConfig } from './providers/LocalConfigProvider';
import { isElectron } from '../utils/isElectron';

export function TabWrapper() {
  const user = useUser(),
    { experimental__use_openai_rag } = useLocalConfig();

  return (
    <div className="mobile-full-height flex flex-col max-w-[100vw] md:flex-row-reverse">
      <div className="flex-grow overflow-y-auto">
        <Outlet />
      </div>
      <div className={`flex-0 md:bg-primary-800 z-20 w-full bg-slate-100 md:relative md:bottom-auto md:top-0 md:h-full md:w-auto ${isElectron() ? 'pt-4' : ''}`}
          style={{
            // @ts-ignore
            "-webkit-app-region": isElectron() ? "drag": "no-drag"
          }}
      >
        <div className="pb-safe md:pb-0 mx-auto flex w-full max-w-3xl justify-around md:h-full md:w-64 md:flex-col md:justify-start">
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
          {experimental__use_openai_rag && (
            <TabButton
              route={AppRoutes.MereAIAssistant}
              title="Mere Assistant"
              smallTitle="Assistant"
              icon={<SparklesIcon />}
            />
          )}
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
                  {user.profile_picture?.data === undefined ? (
                    <svg
                      className="h-full w-full rounded-full text-gray-800"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <img
                      className="h-full w-full rounded-full text-gray-300"
                      src={user.profile_picture.data}
                      alt="profile"
                    ></img>
                  )}
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
