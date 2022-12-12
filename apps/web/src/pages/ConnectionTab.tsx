import { IonContent, IonHeader, IonPage, IonButton } from '@ionic/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { OnPatient } from '../services/OnPatient';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { RxDatabase, RxDocument } from 'rxdb';
import { GenericBanner } from '../components/GenericBanner';
import { ConnectionCard } from '../components/ConnectionCard';
import { Epic } from '../services/Epic';
import EpicEndpoints from '../assets/DSTU2Endpoints.json';

import { Fragment } from 'react';
import { Combobox, Dialog, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

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
      localStorage.setItem(Epic.LocalStorageKeys.EPIC_URL, s);
      localStorage.setItem(Epic.LocalStorageKeys.EPIC_NAME, name);
    },
    getList = useCallback(() => {
      getConnectionCards(db).then((list) => {
        setList(list as unknown as RxDocument<ConnectionDocument>[]);
      });
    }, [db]),
    [open, setOpen] = useState(false),
    toggleEpicPanel = (s: string & Location, name: string) => {
      setTenantEpicUrl(s, name);
      setOpen((x) => !x);
      window.location = Epic.getLoginUrl(s);
    };

  useEffect(() => {
    getList();
  }, [getList]);

  return (
    <IonPage>
      <IonHeader>
        <GenericBanner text="Add Connections" />
      </IonHeader>
      <IonContent fullscreen>
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
            <IonButton className="m-4 h-12 w-11/12" href={onpatientLoginUrl}>
              <p className="font-bold">Log in to OnPatient</p>
            </IonButton>
          </div>
          <div className="box-border flex	w-full justify-center align-middle">
            <IonButton
              className="m-4 h-12 w-11/12"
              onClick={() => setOpen((x) => !x)}
            >
              <p className="font-bold">Log in to Epic MyChart</p>
            </IonButton>
          </div>
        </div>
        <CommandPaletteModal
          open={open}
          setOpen={setOpen}
          onClick={toggleEpicPanel}
        />
      </IonContent>
    </IonPage>
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

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ');
}

export function CommandPaletteModal({
  open,
  setOpen,
  onClick,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onClick: (s: string & Location, name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filteredItems = useCallback((s: string) => {
    return s === ''
      ? items.sort((x, y) => (x.name > y.name ? 1 : -1)).slice(0, 40)
      : items
          .filter((item) => {
            return item.name.toLowerCase().includes(s.toLowerCase());
          })
          .slice(0, 40);
  }, []);

  return (
    <Transition.Root
      show={open}
      as={Fragment}
      afterLeave={() => setQuery('')}
      appear
    >
      <Dialog as="div" className="relative z-10" onClose={setOpen}>
        {/* Background opacity */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-25 transition-opacity" />
        </Transition.Child>
        {/* Modal */}
        <div className="sm:pt-15 fixed inset-0 z-10 overflow-y-auto pt-10 md:pt-20">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="mx-auto h-full max-w-xl transform overflow-hidden rounded-tl-xl rounded-tr-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all sm:h-auto sm:rounded-xl">
              <div className="flex justify-between">
                <p className="p-4 text-xl font-bold">
                  Select your EPIC health system to log in
                </p>
                <button
                  type="button"
                  className="rounded-md bg-white text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-none focus:ring-0 "
                  onClick={() => setOpen(false)}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="mr-4 h-8 w-8" aria-hidden="true" />
                </button>
              </div>
              <Combobox
                onChange={(s: SelectOption) => {
                  onClick(s.url, s.name);
                  setOpen(false);
                }}
              >
                <div className="relative">
                  <MagnifyingGlassIcon
                    className="pointer-events-none absolute top-3.5 left-4 h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                  <Combobox.Input
                    className="h-12 w-full divide-y-2 rounded-md border-0 bg-transparent pl-11 pr-4 text-gray-800 placeholder-gray-400 hover:border-gray-200 focus:ring-0 sm:text-sm"
                    placeholder="Search for your health system"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                {filteredItems(query).length > 0 && (
                  <Combobox.Options
                    static
                    className="scroll-py-3 overflow-y-auto p-3 sm:max-h-96"
                  >
                    {filteredItems(query).map((item) => (
                      <Combobox.Option
                        key={item.id}
                        value={item}
                        className={({ active }) =>
                          classNames(
                            'flex cursor-default select-none rounded-xl p-3',
                            active && 'bg-gray-100'
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
                              {item.name}
                            </p>
                          </div>
                        )}
                      </Combobox.Option>
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
                    <p className="mt-4 font-semibold text-gray-900">
                      No results found
                    </p>
                    <p className="mt-2 text-gray-500">
                      No health system found for this search term. Please try
                      again.
                    </p>
                  </div>
                )}
              </Combobox>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
