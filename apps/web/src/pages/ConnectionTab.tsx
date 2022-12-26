import { memo, useCallback, useEffect, useState } from 'react';
import { ConnectionDocument } from '../models/ConnectionDocument';
import * as OnPatient from '../services/OnPatient';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { RxDatabase, RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { ConnectionCard } from '../components/ConnectionCard';
import EpicEndpoints from '../assets/DSTU2Endpoints.json';

import { Combobox } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@react-hook/debounce';
import { Modal } from '../components/Modal';
import { ModalHeader } from '../components/ModalHeader';
import { EpicLocalStorageKeys, getLoginUrl } from '../services/Epic';
import { AppPage } from '../components/AppPage';

async function getConnectionCards(
  db: RxDatabase<DatabaseCollections, any, any>
) {
  return db.connection_documents
    .find({
      selector: {},
    })
    .exec()
    .then((list) => list as unknown as RxDocument<ConnectionDocument>[]);
}

const ConnectionTab: React.FC = () => {
  const db = useRxDb(),
    [list, setList] = useState<RxDocument<ConnectionDocument>[]>(),
    onpatientLoginUrl = OnPatient.getLoginUrl(),
    setTenantEpicUrl = (s: string & Location, name: string) => {
      localStorage.setItem(EpicLocalStorageKeys.EPIC_URL, s);
      localStorage.setItem(EpicLocalStorageKeys.EPIC_NAME, name);
    },
    getList = useCallback(() => {
      getConnectionCards(db).then((list) => {
        console.log(list.map((x) => x.toJSON()));
        setList(list as unknown as RxDocument<ConnectionDocument>[]);
      });
    }, [db]),
    [open, setOpen] = useState(false),
    toggleEpicPanel = (s: string & Location, name: string) => {
      setTenantEpicUrl(s, name);
      setOpen((x) => !x);
      window.location = getLoginUrl(s);
    };

  useEffect(() => {
    getList();
  }, [getList]);

  return (
    <AppPage banner={<GenericBanner text="Add Connections" />}>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 sm:px-6 lg:px-8">
        <div className="py-6 text-xl font-extrabold">
          Connect to Patient Portal
        </div>
        <div className="text-sm font-medium text-gray-500">
          Connect to a patient portal to automatic download your most recent
          data.
        </div>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 sm:px-6 lg:px-8">
        <ul className="grid grid-cols-1 py-8">
          {list?.map((item) => (
            <ConnectionCard
              key={item._id}
              item={item}
              baseUrl={item.get('location')}
            />
          ))}
        </ul>
        <div className="box-border flex	w-full justify-center align-middle">
          <a
            className="bg-primary mb-4 w-full rounded-lg p-4 text-center text-white"
            href={onpatientLoginUrl}
          >
            <p className="font-bold">Log in to OnPatient</p>
          </a>
        </div>
        <div className="mb-4 box-border	flex w-full justify-center align-middle">
          <button
            className="bg-primary w-full rounded-lg p-4 text-white"
            onClick={() => setOpen((x) => !x)}
          >
            <p className="font-bold">Log in to Epic MyChart</p>
          </button>
        </div>
      </div>
      <EpicSelectModal
        open={open}
        setOpen={setOpen}
        onClick={toggleEpicPanel}
      />
    </AppPage>
  );
};

export default ConnectionTab;

interface SelectOption {
  id: string;
  name: string;
  url: string & Location;
}

const items = [
  ...EpicEndpoints,
  {
    id: 'default',
    name: 'Sandbox',
    url: 'https://fhir.epic.com/interconnect-fhir-oauth',
  },
];

function getNGrams(s: string, len: number) {
  s = ' '.repeat(len - 1) + s.toLowerCase() + ' '.repeat(len - 1);
  const v = new Array(s.length - len + 1);
  for (let i = 0; i < v.length; i++) {
    v[i] = s.slice(i, i + len);
  }
  return v;
}

/**
 * Compares the similarity between two strings using an n-gram comparison method.
 * The grams default to length 2.
 * @param str1 The first string to compare.
 * @param str2 The second string to compare.
 * @param gramSize The size of the grams. Defaults to length 2.
 */
function stringSimilarity(str1: string, str2: string, gramSize = 2) {
  if (!str1?.length || !str2?.length) {
    return 0.0;
  }

  //Order the strings by length so the order they're passed in doesn't matter
  //and so the smaller string's ngrams are always the ones in the set
  const s1 = str1.length < str2.length ? str1 : str2;
  const s2 = str1.length < str2.length ? str2 : str1;

  const pairs1 = getNGrams(s1, gramSize);
  const pairs2 = getNGrams(s2, gramSize);
  const set = new Set<string>(pairs1);

  const total = pairs2.length;
  let hits = 0;
  for (const item of pairs2) {
    if (set.delete(item)) {
      hits++;
    }
  }
  return hits / total;
}

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ');
}

export function EpicSelectModal({
  open,
  setOpen,
  onClick,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onClick: (s: string & Location, name: string) => void;
}) {
  const [query, setQuery] = useDebounce('', 300);
  const filteredItems = useCallback((s: string) => {
    if (s === '') {
      return items.sort((x, y) => (x.name > y.name ? 1 : -1));
    }
    return items
      .map((item) => {
        // Match against each token, take highest score
        const vals = item.name
          .split(' ')
          .map((token) => stringSimilarity(token, s));
        const rating = Math.max(...vals);
        return { rating, item };
      })
      .filter((item) => item.rating > 0.05)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 50)
      .map((item) => item.item);
  }, []);

  return (
    <Modal
      open={open}
      setOpen={setOpen}
      afterLeave={() => setQuery('')}
      overflowHidden
    >
      <ModalHeader
        title={'Select your EPIC health system to log in'}
        setClose={() => setOpen((x) => !x)}
      />
      <Combobox
        onChange={(s: SelectOption) => {
          onClick(s.url, s.name);
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
        {filteredItems(query).length > 0 && (
          <Combobox.Options
            static
            className="max-h-full scroll-py-3 overflow-y-scroll p-3 sm:max-h-96"
          >
            {filteredItems(query).map((item) => (
              <MemoizedResultItem
                key={item.id}
                id={item.id}
                name={item.name}
                url={item.url}
              />
            ))}
          </Combobox.Options>
        )}

        {query !== '' && filteredItems(query).length === 0 && (
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

export const MemoizedResultItem = memo(ResultItem);

function ResultItem({
  id,
  name,
  url,
}: {
  id: string;
  name: string;
  url: string;
}) {
  return (
    <Combobox.Option
      tabIndex={0}
      key={id}
      value={{ id, name, url }}
      className={({ active }) =>
        classNames(
          active && 'bg-gray-100',
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
