import { Combobox } from '@headlessui/react';
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
  baseUrl,
  tokenUrl,
  authUrl,
  vendor,
}: {
  id: string;
  name: string;
  baseUrl: string;
  tokenUrl: string;
  authUrl: string;
  vendor?: string;
}) {
  return (
    <Combobox.Option
      tabIndex={0}
      key={id}
      value={{ id, name, baseUrl, tokenUrl, authUrl, vendor }}
      className={({ active }) =>
        classNames(
          active ? 'bg-gray-100' : '',
          'mb-2 flex cursor-default select-none rounded-xl p-3',
        )
      }
    >
      {({ active }) => (
        <div className="ml-4 flex-auto">
          <p
            className={classNames(
              'text-sm font-medium',
              active ? 'text-gray-900' : 'text-gray-800',
            )}
          >
            {name}
          </p>
        </div>
      )}
    </Combobox.Option>
  );
}

export function SkeletonTenantSelectModalResultItem() {
  const randomTailwindWidth = Math.floor(Math.random() * 100) + 1;

  return (
    <div className="mb-2 flex cursor-default select-none rounded-xl p-3">
      <div className="ml-4 flex-auto">
        <div className="text-sm font-medium text-gray-800">
          <div
            className={`h-4 animate-pulse rounded bg-gray-200`}
            style={{ width: `${randomTailwindWidth}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
