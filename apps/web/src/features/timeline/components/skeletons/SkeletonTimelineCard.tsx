import { memo } from 'react';
import { CardBase } from '../../../connections/components/CardBase';
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
        <div className="relative">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-x-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <div className="my-1 h-3 w-8 rounded-md bg-gray-200 sm:h-4"></div>
              <div className="my-1 h-3 w-8 rounded-md bg-gray-200 sm:h-4"></div>
              <ChevronDownIcon
                className={`-ml-1 -mr-0.5 h-5 w-5 text-gray-400 duration-150 active:scale-95 active:bg-slate-50`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </CardBase>
  );
}

export const SkeletonTimelineCard = memo(SkeletonTimelineCardUnmemoed);
