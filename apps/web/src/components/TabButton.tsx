import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Routes as AppRoutes } from '../Routes';

export function TabButton({
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
          className={`font-xs h-5 w-5 md:mr-4 md:h-8 md:w-8 ${
            location === route ? 'text-primary-700' : 'text-gray-800'
          }`}
        >
          {icon}
        </p>
        <p
          className={`md:font-xs text-[10px] ${
            location === route ? 'text-primary-700' : 'text-gray-800'
          }`}
        >
          {title}
        </p>
      </>
    </Link>
  );
}
