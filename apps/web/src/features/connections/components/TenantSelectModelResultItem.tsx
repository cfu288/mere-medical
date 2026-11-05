import { Combobox } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { classNames } from '../../../shared/utils/StyleUtils';

export type TenantWireVendor = 'EPIC' | 'CERNER' | 'VERADIGM' | 'HEALOW';

export interface SelectOption {
  id: string;
  name: string;
  baseUrl: string & Location;
  authUrl: string & Location;
  tokenUrl: string & Location;
  vendor?: TenantWireVendor;
}

export function TenantSelectModelResultItem({
  id,
  name,
  managingOrganization,
  baseUrl,
  tokenUrl,
  authUrl,
  vendor,
}: {
  id: string;
  name: string;
  managingOrganization?: string;
  baseUrl: string;
  tokenUrl: string;
  authUrl: string;
  vendor?: string;
}) {
  return (
    <Combobox.Option
      key={id}
      value={{ id, name, baseUrl, tokenUrl, authUrl, vendor }}
      className={({ active }) =>
        classNames(
          'mb-2 flex cursor-pointer select-none items-center rounded-xl p-3 ring-inset',
          active
            ? 'ring-primary-700 bg-gray-100 dark:bg-gray-800 ring-2'
            : 'bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700',
        )
      }
    >
      {({ active }) => (
        <>
          <div className="ml-4 flex-auto">
            <p
              className={classNames(
                'text-sm font-medium',
                active
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-800 dark:text-gray-200',
              )}
            >
              {name}
            </p>
            <p
              className={classNames(
                'min-h-4 text-xs',
                active
                  ? 'text-gray-600 dark:text-gray-400'
                  : 'text-gray-500 dark:text-gray-400',
              )}
            >
              {managingOrganization}
            </p>
          </div>
          <ChevronRightIcon
            className={classNames(
              'ml-3 h-5 w-5 flex-none',
              active
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400',
            )}
            aria-hidden="true"
          />
        </>
      )}
    </Combobox.Option>
  );
}

const SKELETON_WIDTHS = Array.from(
  { length: 11 },
  () => Math.floor(Math.random() * 100) + 1,
);

export function SkeletonTenantSelectModalResultItem({
  index,
}: {
  index: number;
}) {
  const randomTailwindWidth = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length];

  return (
    <div className="mb-2 flex select-none items-center rounded-xl bg-white dark:bg-gray-900 p-3 ring-1 ring-inset ring-gray-200 dark:ring-gray-700">
      <div className="ml-4 flex-auto">
        <div
          className="h-5 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
          style={{ width: `${randomTailwindWidth}%` }}
        ></div>
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800"></div>
      </div>
    </div>
  );
}
