/* eslint-disable react/jsx-no-useless-fragment */
import { memo, useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';

import { Combobox } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { DSTU2Endpoint as CernerDSTU2Endpoint } from '@mere/cerner';
import { DSTU2Endpoint as EpicDSTU2Endpoint } from '@mere/epic';
import { DSTU2Endpoint as VeradigmDSTU2Endpoint } from '@mere/veradigm';

import VeradigmLogo from '../../assets/img/allscripts-logo.png';
import CernerLogo from '../../assets/img/cerner-logo.png';
import EpicLogo from '../../assets/img/mychart-logo.png';
import OnpatientLogo from '../../assets/img/onpatient-logo-full.webp';
import { SelectOption } from '../../pages/ConnectionTab';
import { Routes } from '../../Routes';
import * as OnPatient from '../../services/OnPatient';
import { Modal } from '../Modal';
import { ModalHeader } from '../ModalHeader';
import { useNotificationDispatch } from '../providers/NotificationProvider';
import { useUserPreferences } from '../providers/UserPreferencesProvider';
import { getLoginUrl as getVaLoginUrl } from '../../services/VA';
import {
  SkeletonTenantSelectModalResultItem,
  TenantSelectModelResultItem,
} from './TenantSelectModelResultItem';
import VALogo from '../../assets/img/va-logo.png';
import Config from '../../environments/config.json';

export type EMRVendor =
  | 'epic'
  | 'cerner'
  | 'veradigm'
  | 'onpatient'
  | 'va'
  | 'any';

export type UnifiedDSTU2Endpoint = CernerDSTU2Endpoint &
  EpicDSTU2Endpoint &
  VeradigmDSTU2Endpoint & { vendor: EMRVendor };

type TenantSelectState = {
  query: string;
  items: UnifiedDSTU2Endpoint[];
  emrVendor: EMRVendor;
  fhirVersion?: 'DSTU2' | 'R4';
  hasSelectedEmrVendor: boolean;
  isLoadingResults: boolean;
};

type TenantSelectAction =
  | { type: 'setQuery'; payload: string }
  | { type: 'setItems'; payload: UnifiedDSTU2Endpoint[] }
  | {
      type: 'setEmrVendor';
      payload: { vendor: EMRVendor; fhirVersion?: 'DSTU2' | 'R4' };
    }
  | { type: 'goBackToEMRVendorSelect' }
  | { type: 'hasClosedModal' }
  | { type: 'isLoadingResults'; payload: boolean };

const defaultState = {
  query: '',
  items: [],
  emrVendor: 'any',
  hasSelectedEmrVendor: false,
  isLoadingResults: false,
} as TenantSelectState;

type SourceItem = {
  title: string;
  vendor: EMRVendor;
  source: string;
  alt?: string;
  href?: string;
  enabled: boolean;
  customHandleClick?: () => void;
  id: number;
  fhirVersion?: 'DSTU2' | 'R4';
};

export function TenantSelectModal({
  open,
  setOpen,
  onClick,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onClick: (
    base: string & Location,
    auth: string & Location,
    token: string & Location,
    name: string,
    id: string,
    vendor: EMRVendor,
    fhirVersion?: 'DSTU2' | 'R4',
  ) => void;
}) {
  const userPreferences = useUserPreferences(),
    notifyDispatch = useNotificationDispatch();

  const [state, dispatch] = useReducer(
    (
      state: TenantSelectState,
      action: TenantSelectAction,
    ): TenantSelectState => {
      switch (action.type) {
        case 'setQuery':
          return { ...state, query: action.payload };
        case 'setItems':
          return { ...state, items: action.payload, isLoadingResults: false };
        case 'setEmrVendor':
          return {
            ...state,
            emrVendor: action.payload.vendor,
            fhirVersion: action.payload.fhirVersion,
            hasSelectedEmrVendor: true,
            isLoadingResults: true,
          };
        case 'goBackToEMRVendorSelect':
          return defaultState;
        case 'hasClosedModal':
          return { ...state, hasSelectedEmrVendor: false, query: '' };
        default:
          return state;
      }
    },
    {
      query: '',
      items: [],
      emrVendor: 'any',
      hasSelectedEmrVendor: false,
      isLoadingResults: false,
    },
  );

  const [vaUrl, setVaUrl] = useState<string & Location>(
    '' as string & Location,
  );

  useEffect(() => {
    // get VA url
    getVaLoginUrl().then((url) => {
      setVaUrl(url);
    });
  }, []);

  const ConnectionSources: SourceItem[] = useMemo(() => {
    const sources = [
      {
        title: 'MyChart',
        vendor: 'epic',
        source: EpicLogo,
        alt: 'Epic',
        enabled: true,
        id: 1,
      },
      {
        title: 'Cerner',
        vendor: 'cerner',
        source: CernerLogo,
        alt: 'R4 FHIR',
        enabled: true,
        id: 2,
        fhirVersion: 'R4',
      },
      {
        title: 'Allscripts',
        vendor: 'veradigm',
        source: VeradigmLogo,
        alt: 'Veradigm',
        enabled: true,
        id: 3,
      },
      !userPreferences?.use_proxy
        ? {
            title: 'OnPatient',
            vendor: 'onpatient',
            source: OnpatientLogo,
            alt: 'Dr. Chrono',
            href: OnPatient.getLoginUrl(),
            enabled: false,
            id: 4,
          }
        : {
            title: 'OnPatient',
            vendor: 'onpatient',
            source: OnpatientLogo,
            alt: 'Dr. Chrono',
            href: OnPatient.getLoginUrl(),
            enabled: true,
            id: 4,
          },
      {
        title: 'Veterans Affairs',
        vendor: 'va',
        source: VALogo,
        alt: 'Sandbox Only',
        href: vaUrl,
        enabled: true,
        id: 4,
      },
      {
        title: 'Search All',
        vendor: 'any',
        source: '',
        alt: 'Search all supported health systems',
        enabled: true,
        id: 5,
      },
      {
        title: 'Cerner Legacy',
        vendor: 'cerner',
        source: CernerLogo,
        alt: 'DSTU2 (older version)',
        enabled: true,
        id: 6,
        fhirVersion: 'DSTU2',
      },
    ];

    return sources as SourceItem[];
  }, [userPreferences?.use_proxy, vaUrl]);

  useEffect(() => {
    const abortController = new AbortController();

    if (state.hasSelectedEmrVendor) {
      const apiPath =
        state.emrVendor === 'cerner'
          ? state.fhirVersion === 'R4'
            ? `/api/v1/cerner/r4/tenants?`
            : `/api/v1/cerner/tenants?`
          : state.emrVendor !== 'any'
            ? `/api/v1/${state.emrVendor}/tenants?`
            : `/api/v1/dstu2/tenants?`;

      fetch(
        Config.PUBLIC_URL +
          apiPath +
          new URLSearchParams({ query: state.query }),
        {
          signal: abortController.signal,
        },
      )
        .then((x) => x.json())
        .then((x) => dispatch({ type: 'setItems', payload: x }))
        .catch(() => {
          notifyDispatch({
            type: 'set_notification',
            message: `Unable to search for health systems`,
            variant: 'error',
          });
          dispatch({ type: 'setItems', payload: [] });
        });
    }

    return () => {
      abortController.abort();
    };
  }, [
    state.emrVendor,
    state.query,
    notifyDispatch,
    state.hasSelectedEmrVendor,
  ]);

  return (
    <Modal
      open={open}
      setOpen={setOpen}
      afterLeave={() => {
        dispatch({ type: 'hasClosedModal' });
      }}
      overflowXHidden
      flex
    >
      <>
        {!state.hasSelectedEmrVendor ? (
          <>
            <ModalHeader
              title={'Which patient portal do you use?'}
              setClose={() => setOpen((x) => !x)}
            />
            <div className="flex h-full max-h-full scroll-py-3 flex-col items-center justify-center overflow-y-scroll pt-8 sm:pt-0">
              <ul
                className="grid w-full grid-cols-2 gap-x-4 gap-y-8 px-4 py-8 sm:grid-cols-3 sm:gap-x-8 sm:px-4 sm:py-12" // lg:grid-cols-4 xl:gap-x-8"
              >
                {ConnectionSources.map((file) => (
                  <li key={file.source} className="relative">
                    {file.href ? (
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          if (Config.IS_DEMO === 'enabled') {
                            notifyDispatch({
                              type: 'set_notification',
                              message:
                                'Adding new connections is disabled in demo mode',
                              variant: 'error',
                            });
                            return;
                          }
                          if (!file.enabled) {
                            window.location.href = Routes.AddConnection;
                          } else if (file.href) {
                            window.location.href = file.href;
                          }
                        }}
                      >
                        <div className="aspect-h-7 aspect-w-10 focus-within:ring-primary-500 bg-primary-700 hover:bg-primary-600 group block w-full overflow-hidden rounded-lg transition-all focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100">
                          {file.source !== '' ? (
                            <img
                              src={file.source}
                              alt={file.title}
                              className="pointer-events-none object-cover group-hover:opacity-75"
                            />
                          ) : (
                            <div className="text-primary-100 pointer-events-none flex items-center justify-center text-3xl font-bold">
                              {file.title}
                            </div>
                          )}
                          <button
                            type="button"
                            className="absolute inset-0 focus:outline-none"
                          >
                            <span className="sr-only">{`Select ${file.title}`}</span>
                          </button>
                        </div>
                        <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">
                          {file.title}
                        </p>
                        {!file.enabled ? (
                          <p className="pointer-events-none block text-sm font-medium text-gray-700">
                            To enable, go to{' '}
                            <Link
                              className="text-primary hover:text-primary-500 w-full text-center underline"
                              to={`${Routes.Settings}#use_proxy`}
                            >
                              the settings page
                            </Link>{' '}
                            and enable the <code>use proxy</code> setting.
                          </p>
                        ) : (
                          <>
                            {file.alt && (
                              <p className="pointer-events-none block text-sm font-medium text-gray-700">
                                {file.alt}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div
                          className="aspect-h-7 aspect-w-10 focus-within:ring-primary-500 bg-primary-700 hover:bg-primary-600 group block w-full overflow-hidden rounded-lg transition-all focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100"
                          onClick={() => {
                            if (Config.IS_DEMO === 'enabled') {
                              notifyDispatch({
                                type: 'set_notification',
                                message:
                                  'Adding new connections is disabled in demo mode',
                                variant: 'error',
                              });
                              return;
                            }
                            if (file.customHandleClick) {
                              file.customHandleClick();
                            } else {
                              dispatch({
                                type: 'setEmrVendor',
                                payload: {
                                  vendor: file.vendor,
                                  fhirVersion: file.fhirVersion,
                                },
                              });
                            }
                          }}
                        >
                          {file.source !== '' ? (
                            <img
                              src={file.source}
                              alt={file.title}
                              className="pointer-events-none object-cover group-hover:opacity-75"
                            />
                          ) : (
                            <div className="text-primary-100 pointer-events-none flex items-center justify-center text-3xl font-bold">
                              {file.title}
                            </div>
                          )}
                          <button
                            type="button"
                            className="absolute inset-0 focus:outline-none"
                          >
                            <span className="sr-only">{`Select ${file.title}`}</span>
                          </button>
                        </div>
                        <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">
                          {file.title}
                        </p>
                        {file.alt && (
                          <p className="pointer-events-none block text-sm font-medium text-gray-700">
                            {file.alt}
                          </p>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <ModalHeader
              title={`Select your healthcare institution to log in`}
              setClose={() => setOpen((x) => !x)}
              back={() => {
                dispatch({ type: 'goBackToEMRVendorSelect' });
              }}
            />
            {state.isLoadingResults ? (
              <Combobox>
                <Combobox.Options
                  static
                  className="max-h-full scroll-py-3 overflow-y-scroll p-3 sm:max-h-96"
                >
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                  <SkeletonTenantSelectModalResultItem />
                </Combobox.Options>
              </Combobox>
            ) : (
              <>
                <Combobox
                  onChange={(s: SelectOption) => {
                    const selectedSource = ConnectionSources.find(
                      (src) => src.vendor === state.emrVendor,
                    );
                    onClick(
                      s.baseUrl,
                      s.authUrl,
                      s.tokenUrl,
                      s.name,
                      s.id,
                      state.emrVendor,
                      selectedSource?.fhirVersion,
                    );
                    setOpen(false);
                  }}
                >
                  <div className="relative px-4">
                    <MagnifyingGlassIcon
                      className="pointer-events-none absolute left-8 top-3.5 h-5 w-5 text-gray-700"
                      aria-hidden="true"
                    />
                    <Combobox.Input
                      title="tenant-search-bar"
                      className="focus:ring-primary-700 h-12 w-full divide-y-2 rounded-xl border-0 bg-gray-100 bg-transparent pl-11 pr-4 text-gray-800 placeholder-gray-400 hover:border-gray-200 focus:ring-2 sm:text-sm"
                      placeholder="Search for your health system"
                      onChange={(event) =>
                        dispatch({
                          type: 'setQuery',
                          payload: event.target.value,
                        })
                      }
                      autoFocus={true}
                    />
                  </div>
                  {state.items.length > 0 && (
                    <Combobox.Options
                      static
                      className="max-h-full scroll-py-3 overflow-y-scroll p-3 sm:max-h-96"
                    >
                      {state.items.map((item) => (
                        <MemoizedResultItem
                          key={item.id}
                          id={item.id}
                          name={item.name}
                          baseUrl={item.url}
                          tokenUrl={item.token}
                          authUrl={item.authorize}
                        />
                      ))}
                    </Combobox.Options>
                  )}
                  {state.query !== '' && state.items.length === 0 && (
                    <div className="px-6 py-14 text-center text-sm sm:px-14">
                      <ExclamationCircleIcon
                        type="outline"
                        name="exclamation-circle"
                        className="mx-auto h-6 w-6 text-gray-700"
                      />
                      <p className="mt-4 font-semibold text-gray-900">
                        No results found
                      </p>
                      <p className="mt-2 text-gray-800">
                        No health system found for this search term. Please try
                        again.
                      </p>
                    </div>
                  )}
                </Combobox>
              </>
            )}
          </>
        )}
      </>
    </Modal>
  );
}

const MemoizedResultItem = memo(TenantSelectModelResultItem);
