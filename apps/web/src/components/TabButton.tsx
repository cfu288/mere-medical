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
      className={`flex w-24 flex-col items-center justify-center p-2 pb-3 text-white md:m-1 md:w-auto md:flex-row md:justify-start md:rounded-md md:p-4 ${
        location === route
          ? 'bg-gray-0 md:bg-primary-700 border-primary border-t-2 md:border-t-0'
          : ''
      }`}
    >
      <>
        <p
          className={`font-xs h-5 w-5 text-base md:mr-4 md:h-8 md:w-8 md:text-white ${
            location === route ? 'text-primary font-bold' : 'text-slate-800'
          }`}
        >
          {icon}
        </p>
        <p
          className={`pt-1 text-[11px] text-white md:pt-0 md:text-base md:text-white ${
            location === route ? 'text-primary font-bold' : 'text-slate-800'
          }`}
        >
          {title}
        </p>
      </>
    </Link>
  );
}
