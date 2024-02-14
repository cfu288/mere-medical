import { memo } from 'react';
import { CardBase } from '../connection/CardBase';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export function SkeletonTimelineCardUnmemoed() {
  return (
    <CardBase>
      <div className="w-full min-w-0 max-w-full flex-1">
        <div className="flex animate-pulse flex-row items-center pb-2">
          <div className="mt-1 h-4 w-12 rounded-md bg-gray-100 sm:h-4 "></div>
        </div>
        <div className="mb-2 ml-2">
          <span className="absolute inset-0" aria-hidden="true" />
          <div className="mb-2 mt-1 h-4 w-20 rounded-md bg-gray-100 sm:h-4 "></div>
          <div className="ml-2">
            <ul className="list-disc list-inside">
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex animate-pulse flex-row items-center pb-2">
          <div className="mt-1 h-4 w-20 rounded-md bg-gray-100 sm:h-4 "></div>
        </div>
        <div className="mb-2 ml-2">
          <span className="absolute inset-0" aria-hidden="true" />
          <div className="mb-2 mt-1 h-4 w-20 rounded-md bg-gray-100 sm:h-4 "></div>
          <div className="ml-2">
            <ul className="list-disc list-inside">
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
              <li className="text-xs font-medium md:text-sm text-gray-900 flex flex-row flex-wrap items-center gap-x-2">
                <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div>
                <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div>
              </li>
            </ul>
          </div>

          {/* <div className="mt-1 h-3 w-24 rounded-md bg-gray-200 sm:h-4"></div> */}
          {/* <div className="mt-1 h-3 w-12 rounded-md bg-gray-200 sm:h-4"></div> */}
          {/* <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div> */}
          {/* <div className="mt-1 h-3 w-10 rounded-md bg-gray-200 sm:h-4"></div> */}
          {/* <div className="mt-1 h-3 w-4 rounded-md bg-gray-200 sm:h-4"></div>
          <div className="mt-1 h-3 w-6 rounded-md bg-gray-200 sm:h-4"></div>
          <div className="mt-1 h-3 w-12 rounded-md bg-gray-200 sm:h-4"></div> */}
        </div>
        <button
          type="button"
          className={`py-1 my-1 sm:py-0 text-primary-800 font-medium text-sm md:text-base flex items-center gap-x-1 ring-primary-700 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 active:rounded-md active:duration-150 w-full text-center content-center justify-center rounded-md hover:ring-2 hover:scale-[101%] active:ring-opacity-50 hover:rounded-md hover:duration-150 transition-all duration-150 ease-in-out `}
        >
          <div className="mt-1 h-3 w-8 rounded-md bg-gray-200 sm:h-4"></div>
          <div className="mt-1 h-3 w-8 rounded-md bg-gray-200 sm:h-4"></div>
          <ChevronDownIcon
            className={`h-3 w-3 rounded duration-150 active:scale-95 active:bg-slate-50`}
          />
        </button>
      </div>
    </CardBase>
  );
}

export const SkeletonTimelineCard = memo(SkeletonTimelineCardUnmemoed);
