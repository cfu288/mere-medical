import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { CardBase } from '../connection/CardBase';

export function SkeletonListCard() {
  return (
    <Disclosure defaultOpen={true}>
      {({ open }) => (
        <>
          <Disclosure.Button className="w-full font-bold">
            <div className="flex w-full items-center justify-between py-6 text-xl font-extrabold">
              <div className="mt-2 h-5 w-36 rounded-md bg-gray-200"></div>
              <ChevronDownIcon
                className={`h-8 w-8 rounded duration-150 active:scale-95 active:bg-slate-50 ${
                  open ? 'rotate-180 transform' : ''
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel>
            <CardBase>
              <div className="min-w-0 flex-1">
                <div className="py-2">
                  <div className="mt-1 h-4 w-48 rounded-md bg-gray-200 sm:h-4"></div>
                  <div className="mt-1 h-3 w-32 animate-pulse rounded-md bg-gray-100 md:mt-2 md:h-4"></div>
                </div>
                <div className="py-2">
                  <div className="mt-1 h-4 w-32 rounded-md bg-gray-200 sm:h-4"></div>
                  <div className="mt-1 h-3 w-24 animate-pulse rounded-md bg-gray-100 md:mt-2 md:h-4"></div>
                </div>
                <div className="py-2">
                  <div className="mt-1 h-4 w-48 rounded-md bg-gray-200 sm:h-4"></div>
                  <div className="mt-1 h-3 w-32 animate-pulse rounded-md bg-gray-100 md:mt-2 md:h-4"></div>
                </div>
                <div className="py-2">
                  <div className="mt-1 h-4 w-32 rounded-md bg-gray-200 sm:h-4"></div>
                  <div className="mt-1 h-3 w-24 animate-pulse rounded-md bg-gray-100 md:mt-2 md:h-4"></div>
                </div>
              </div>
            </CardBase>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
