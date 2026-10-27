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
            ? 'ring-primary-700 bg-gray-100 ring-2'
            : 'bg-white ring-1 ring-gray-200',
        )
      }
    >
      {({ active }) => (
        <>
          <div className="ml-4 flex-auto">
            <p
              className={classNames(
                'text-sm font-medium',
                active ? 'text-gray-900' : 'text-gray-800',
              )}
            >
              {name}
            </p>
            <p
              className={classNames(
                'min-h-4 text-xs',
                active ? 'text-gray-600' : 'text-gray-500',
              )}
            >
              {managingOrganization}
            </p>
          </div>
          <ChevronRightIcon
            className={classNames(
              'ml-3 h-5 w-5 flex-none',
              active ? 'text-gray-900' : 'text-gray-500',
            )}
            aria-hidden="true"
          />
        </>
      )}
    </Combobox.Option>
  );
}

export function SkeletonTenantSelectModalResultItem() {
  const randomTailwindWidth = Math.floor(Math.random() * 100) + 1;

  return (
    <div className="mb-2 flex select-none items-center rounded-xl bg-white p-3 ring-1 ring-inset ring-gray-200">
      <div className="ml-4 flex-auto">
        <div
          className="h-5 animate-pulse rounded bg-gray-200"
          style={{ width: `${randomTailwindWidth}%` }}
        ></div>
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100"></div>
      </div>
    </div>
  );
}
