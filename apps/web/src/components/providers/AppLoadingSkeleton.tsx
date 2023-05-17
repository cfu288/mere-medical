import React from 'react';
import logoCol from '../../assets/logo.svg';
import logo from '../../img/white-logo.svg';
import { Transition } from '@headlessui/react';
import { AppPage } from '../AppPage';
import { TimelineBanner } from '../timeline/TimelineBanner';

export function AppLoadingSkeleton({ ready }: { ready?: boolean }) {
  return (
    <div className="mobile-full-height flex max-w-[100vw] overflow-hidden md:flex-row-reverse">
      <div className="flex-grow">
        <AppPage banner={<TimelineBanner />}>
          <Transition
            as="div"
            className={
              'flex h-full w-full flex-col items-center justify-center'
            }
            show={ready}
            leave="transition-opacity ease-in-out duration-75"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            enter="transition-opacity ease-in-out duration-75"
            enterFrom="opacity-0"
            enterTo="opacity-100"
          >
            <div className="relative h-24 w-24 md:h-48 md:w-48">
              <img
                className="absolute top-0 left-0 h-24 w-24 animate-ping opacity-25 md:h-48 md:w-48"
                src={logoCol}
                alt="Loading screen"
              ></img>
              <img
                className="absolute top-0 left-0 h-24 w-24 opacity-25 md:h-48 md:w-48"
                src={logoCol}
                alt="Loading screen"
              ></img>
            </div>
          </Transition>
        </AppPage>
      </div>
      <div className="flex-0 md:bg-primary-800 absolute bottom-0 left-0 z-20 w-full bg-slate-50 md:relative md:bottom-auto md:top-0 md:h-full md:w-auto">
        <div className="pb-safe mx-auto flex w-full max-w-3xl justify-around md:h-full md:w-64 md:flex-col md:justify-start">
          <img
            src={logo}
            className="hidden h-20 w-20 p-4 md:block"
            alt="logo_spacer"
          ></img>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`flex w-24 flex-col items-center justify-center p-2 text-white md:m-1 md:w-auto md:flex-row md:justify-start md:rounded-md md:p-4 ${
                i === 0
                  ? 'bg-gray-0 md:bg-primary-700 border-primary border-t-2 md:border-t-0'
                  : ''
              }`}
            >
              <div
                className={`font-xs h-5 w-5 text-base md:mr-4 md:h-8 md:w-8 md:text-white ${
                  i === 0 ? 'text-primary font-bold' : 'text-slate-800'
                }`}
              >
                <div className="flex animate-pulse flex-row items-center">
                  <div className="aspect-square w-10 rounded-full bg-gray-400"></div>
                </div>
              </div>
              <div
                className={`pt-1 text-[11px] text-white md:pt-0 md:text-base md:text-white ${
                  i === 0 ? 'text-primary font-bold' : 'text-slate-800'
                }`}
              >
                <div className="flex h-4 animate-pulse flex-row items-center">
                  <div className="h-4 w-12 rounded-md bg-gray-400 md:w-24"></div>
                </div>
              </div>
            </div>
          ))}
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
                  <div className="text-base font-medium text-white">
                    <div className="flex h-4 animate-pulse flex-row items-center md:mb-2">
                      <div className="h-4 w-32 rounded-md bg-gray-500"></div>
                    </div>
                  </div>
                  <div className="flex h-4 animate-pulse flex-row items-center">
                    <div className="h-4 w-32 rounded-md bg-gray-400"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
