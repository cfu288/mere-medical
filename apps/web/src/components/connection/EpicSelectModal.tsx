import { memo, useEffect, useState } from 'react';
import { Combobox } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@react-hook/debounce';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { DSTU2Endpoint } from '@mere/epic';
import { EpicSelectModelResultItem } from './EpicSelectModelResultItem';
import { useNotificationDispatch } from '../providers/NotificationProvider';

export function EpicSelectModal({
  open,
  setOpen,
  onClick,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onClick: (s: string & Location, name: string, id: string) => void;
}) {
  const [query, setQuery] = useDebounce('', 150);
  const [items, setItems] = useState<DSTU2Endpoint[]>([]),
    notifyDispatch = useNotificationDispatch();

  useEffect(() => {
    const abortController = new AbortController();

    fetch(`/api/v1/epic/tenants?` + new URLSearchParams({ query }), {
      signal: abortController.signal,
    })
      .then((x) => x.json())
      .then((x) => setItems(x))
      .catch(() => {
        notifyDispatch({
          type: 'set_notification',
          message: `Unable to search for health systems`,
          variant: 'error',
        });
      });

    return () => {
      abortController.abort();
    };
  }, [notifyDispatch, query]);

  return (
    <Modal
      open={open}
      setOpen={setOpen}
      afterLeave={() => setQuery('')}
      overflowHidden
    >
      <ModalHeader
        title={'Select your Epic health system to log in'}
        setClose={() => setOpen((x) => !x)}
      />
      <Combobox
        onChange={(s: { url: string & Location; name: string; id: string }) => {
          onClick(s.url, s.name, s.id);
          setOpen(false);
        }}
      >
        <div className="relative px-4">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-3.5 left-8 h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
          <Combobox.Input
            className="focus:ring-primary-700 h-12 w-full divide-y-2 rounded-xl border-0 bg-gray-50 bg-transparent pl-11 pr-4 text-gray-800 placeholder-gray-400 hover:border-gray-200 focus:ring-2 sm:text-sm"
            placeholder="Search for your health system"
            onChange={(event) => setQuery(event.target.value)}
            autoFocus={true}
          />
        </div>
        {items.length > 0 && (
          <Combobox.Options
            static
            className="max-h-full scroll-py-3 overflow-y-scroll p-3 sm:max-h-96"
          >
            {items.map((item) => (
              <MemoizedResultItem
                key={item.id}
                id={item.id}
                name={item.name}
                url={item.url}
              />
            ))}
          </Combobox.Options>
        )}

        {query !== '' && items.length === 0 && (
          <div className="py-14 px-6 text-center text-sm sm:px-14">
            <ExclamationCircleIcon
              type="outline"
              name="exclamation-circle"
              className="mx-auto h-6 w-6 text-gray-400"
            />
            <p className="mt-4 font-semibold text-gray-900">No results found</p>
            <p className="mt-2 text-gray-500">
              No health system found for this search term. Please try again.
            </p>
          </div>
        )}
      </Combobox>
    </Modal>
  );
}

const MemoizedResultItem = memo(EpicSelectModelResultItem);
