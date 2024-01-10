import { Combobox } from '@headlessui/react';
import { classNames } from '../../utils/StyleUtils';

export function EpicSelectModelResultItem({
  id,
  name,
  baseUrl,
  tokenUrl,
  authUrl,
}: {
  id: string;
  name: string;
  baseUrl: string;
  tokenUrl: string;
  authUrl: string;
}) {
  return (
    <Combobox.Option
      tabIndex={0}
      key={id}
      value={{ id, name, baseUrl, tokenUrl, authUrl }}
      className={({ active }) =>
        classNames(
          active ? 'bg-gray-100' : '',
          'mb-2 flex cursor-default select-none rounded-xl p-3'
        )
      }
    >
      {({ active }) => (
        <div className="ml-4 flex-auto">
          <p
            className={classNames(
              'text-sm font-medium',
              active ? 'text-gray-900' : 'text-gray-700'
            )}
          >
            {name}
          </p>
        </div>
      )}
    </Combobox.Option>
  );
}
