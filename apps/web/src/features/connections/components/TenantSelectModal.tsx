/* eslint-disable react/jsx-no-useless-fragment */
import { memo, useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';

import { Combobox, Disclosure } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { DSTU2Endpoint as CernerDSTU2Endpoint } from '@mere/cerner';
import { DSTU2Endpoint as EpicDSTU2Endpoint } from '@mere/epic';
import { DSTU2Endpoint as VeradigmDSTU2Endpoint } from '@mere/veradigm';

import VeradigmLogo from '../../../assets/img/allscripts-logo.png';
import CernerLogo from '../../../assets/img/cerner-logo.png';
import EpicLogo from '../../../assets/img/mychart-logo.png';
import OnpatientLogo from '../../../assets/img/onpatient-logo-full.webp';
import { SelectOption } from '../ConnectionTab';
import { Routes } from '../../../Routes';
import * as OnPatient from '../../../services/fhir/OnPatient';
import { Modal } from '../../../shared/components/Modal';
import { ModalHeader } from '../../../shared/components/ModalHeader';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { useUserPreferences } from '../../../app/providers/UserPreferencesProvider';
import { getLoginUrl as getVaLoginUrl } from '../../../services/fhir/VA';
import {
  SkeletonTenantSelectModalResultItem,
  TenantSelectModelResultItem,
} from './TenantSelectModelResultItem';
import VALogo from '../../../assets/img/va-logo.png';
import { useConfig } from '../../../app/providers/AppConfigProvider';

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
  disabledMessage?: string;
  customHandleClick?: () => void;
  id: number;
  fhirVersion?: 'DSTU2' | 'R4';
};

function isConfigured(value: string | undefined): boolean {
  return !!value && !value.startsWith('$');
}

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
  const config = useConfig();

  const epicR4ProductionConfigured =
    isConfigured(config.EPIC_CLIENT_ID_R4) ||
    isConfigured(config.EPIC_CLIENT_ID);
  const epicR4SandboxConfigured =
    isConfigured(config.EPIC_SANDBOX_CLIENT_ID_R4) ||
    isConfigured(config.EPIC_SANDBOX_CLIENT_ID);
  const epicR4Enabled = epicR4ProductionConfigured || epicR4SandboxConfigured;
  const epicR4SandboxOnly =
    epicR4SandboxConfigured && !epicR4ProductionConfigured;

  const epicDstu2ProductionConfigured =
    isConfigured(config.EPIC_CLIENT_ID_DSTU2) ||
    isConfigured(config.EPIC_CLIENT_ID);
  const epicDstu2SandboxConfigured =
    isConfigured(config.EPIC_SANDBOX_CLIENT_ID_DSTU2) ||
    isConfigured(config.EPIC_SANDBOX_CLIENT_ID);
  const epicDstu2Enabled =
    epicDstu2ProductionConfigured || epicDstu2SandboxConfigured;
  const epicDstu2SandboxOnly =
    epicDstu2SandboxConfigured && !epicDstu2ProductionConfigured;

  const cernerEnabled = isConfigured(config.CERNER_CLIENT_ID);
  const veradigmEnabled = isConfigured(config.VERADIGM_CLIENT_ID);
  const vaEnabled = isConfigured(config.VA_CLIENT_ID);

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
    getVaLoginUrl(config).then((url) => {
      setVaUrl(url);
    });
  }, [config]);

  const ConnectionSources: SourceItem[] = useMemo(() => {
    const sources = [
      {
        title: 'MyChart',
        vendor: 'epic',
        source: EpicLogo,
        alt: epicR4SandboxOnly
          ? 'Sandbox only - set EPIC_CLIENT_ID_R4 for production'
          : undefined,
        enabled: epicR4Enabled,
        disabledMessage:
          'Provide EPIC_CLIENT_ID_R4 or EPIC_SANDBOX_CLIENT_ID_R4 env var to enable',
        id: 1,
        fhirVersion: 'R4',
      },
      {
        title: 'Cerner',
        vendor: 'cerner',
        source: CernerLogo,
        enabled: cernerEnabled,
        disabledMessage: 'Provide CERNER_CLIENT_ID env var to enable',
        id: 2,
        fhirVersion: 'R4',
      },
      {
        title: 'Allscripts',
        vendor: 'veradigm',
        source: VeradigmLogo,
        alt: 'Veradigm',
        enabled: veradigmEnabled,
        disabledMessage: 'Provide VERADIGM_CLIENT_ID env var to enable',
        id: 3,
      },
      !userPreferences?.use_proxy
        ? {
            title: 'OnPatient',
            vendor: 'onpatient',
            source: OnpatientLogo,
            alt: 'Dr. Chrono',
            href: OnPatient.getLoginUrl(config),
            enabled: false,
            id: 4,
          }
        : {
            title: 'OnPatient',
            vendor: 'onpatient',
            source: OnpatientLogo,
            alt: 'Dr. Chrono',
            href: OnPatient.getLoginUrl(config),
            enabled: true,
            id: 4,
          },
      {
        title: 'Veterans Affairs',
        vendor: 'va',
        source: VALogo,
        alt: 'Sandbox Only',
        href: vaUrl,
        enabled: vaEnabled,
        disabledMessage: 'Provide VA_CLIENT_ID env var to enable',
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
        enabled: cernerEnabled,
        disabledMessage: 'Provide CERNER_CLIENT_ID env var to enable',
        id: 6,
        fhirVersion: 'DSTU2',
      },
      {
        title: 'MyChart Legacy',
        vendor: 'epic',
        source: EpicLogo,
        alt: epicDstu2SandboxOnly
          ? 'Sandbox only - set EPIC_CLIENT_ID_DSTU2 for production'
          : undefined,
        enabled: epicDstu2Enabled,
        disabledMessage:
          'Provide EPIC_CLIENT_ID_DSTU2 or EPIC_SANDBOX_CLIENT_ID_DSTU2 env var to enable',
        id: 8,
        fhirVersion: 'DSTU2',
      },
    ];

    return sources as SourceItem[];
  }, [
    config,
    userPreferences?.use_proxy,
    vaUrl,
    epicR4Enabled,
    epicR4SandboxOnly,
    epicDstu2Enabled,
    epicDstu2SandboxOnly,
    cernerEnabled,
    veradigmEnabled,
    vaEnabled,
  ]);

  const mainSources = useMemo(
    () => ConnectionSources.filter((s) => s.fhirVersion !== 'DSTU2'),
    [ConnectionSources],
  );

  const legacySources = useMemo(
    () => ConnectionSources.filter((s) => s.fhirVersion === 'DSTU2'),
    [ConnectionSources],
  );

  useEffect(() => {
    const abortController = new AbortController();

    if (state.hasSelectedEmrVendor) {
      const apiPath =
        state.emrVendor === 'cerner'
          ? state.fhirVersion === 'R4'
            ? `/api/v1/cerner/r4/tenants?`
            : `/api/v1/cerner/tenants?`
          : state.emrVendor === 'epic'
            ? state.fhirVersion === 'R4'
              ? `/api/v1/epic/r4/tenants?`
              : `/api/v1/epic/tenants?`
            : state.emrVendor !== 'any'
              ? `/api/v1/${state.emrVendor}/tenants?`
              : `/api/v1/dstu2/tenants?`;

      const sandboxOnly =
        state.emrVendor === 'epic' &&
        ((state.fhirVersion === 'R4' && epicR4SandboxOnly) ||
          (state.fhirVersion === 'DSTU2' && epicDstu2SandboxOnly));

      const params: Record<string, string> = { query: state.query };
      if (sandboxOnly) {
        params['sandboxOnly'] = 'true';
      }

      fetch(config.PUBLIC_URL + apiPath + new URLSearchParams(params), {
        signal: abortController.signal,
      })
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
    state.fhirVersion,
    config.PUBLIC_URL,
    epicR4SandboxOnly,
    epicDstu2SandboxOnly,
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
            <div className="flex h-full max-h-full scroll-py-3 flex-col items-center overflow-y-scroll pt-8 sm:pt-0">
              <ul
                className="grid w-full grid-cols-2 gap-x-4 gap-y-8 px-4 py-8 sm:grid-cols-3 sm:gap-x-8 sm:px-4 sm:py-12" // lg:grid-cols-4 xl:gap-x-8"
              >
                {mainSources.map((file) => (
                  <li key={file.source} className="relative">
                    {file.href ? (
                      <div
                        className={
                          file.enabled ? 'cursor-pointer' : 'cursor-not-allowed'
                        }
                        onClick={() => {
                          if (!file.enabled) return;
                          if (IS_DEMO === 'enabled') {
                            notifyDispatch({
                              type: 'set_notification',
                              message:
                                'Adding new connections is disabled in demo mode',
                              variant: 'error',
                            });
                            return;
                          }
                          if (file.href) {
                            window.location.href = file.href;
                          }
                        }}
                      >
                        <div
                          className={`aspect-h-7 aspect-w-10 focus-within:ring-primary-500 group block w-full overflow-hidden rounded-lg transition-all focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 ${
                            file.enabled
                              ? 'bg-primary-700 hover:bg-primary-600'
                              : 'bg-gray-400'
                          }`}
                        >
                          {file.source !== '' ? (
                            <img
                              src={file.source}
                              alt={file.title}
                              className={`pointer-events-none object-cover ${file.enabled ? 'group-hover:opacity-75' : 'opacity-50'}`}
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
                          file.disabledMessage ? (
                            <p className="block text-sm font-medium text-gray-500">
                              {file.disabledMessage}
                            </p>
                          ) : (
                            <p className="pointer-events-auto relative z-10 block text-sm font-medium text-gray-700">
                              To enable, go to{' '}
                              <Link
                                className="text-primary hover:text-primary-500 w-full text-center underline"
                                to={`${Routes.Settings}#use_proxy`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                the settings page
                              </Link>{' '}
                              and enable the <code>use proxy</code> setting.
                            </p>
                          )
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
                          className={`aspect-h-7 aspect-w-10 focus-within:ring-primary-500 group block w-full overflow-hidden rounded-lg transition-all focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 ${
                            file.enabled
                              ? 'bg-primary-700 hover:bg-primary-600 cursor-pointer'
                              : 'bg-gray-400 cursor-not-allowed'
                          }`}
                          onClick={() => {
                            if (!file.enabled) return;
                            if (IS_DEMO === 'enabled') {
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
                              className={`pointer-events-none object-cover ${file.enabled ? 'group-hover:opacity-75' : 'opacity-50'}`}
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
                        {!file.enabled && file.disabledMessage ? (
                          <p className="block text-sm font-medium text-gray-500">
                            {file.disabledMessage}
                          </p>
                        ) : (
                          file.alt && (
                            <p className="pointer-events-none block text-sm font-medium text-gray-700">
                              {file.alt}
                            </p>
                          )
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <Disclosure as="div" className="w-full">
                {({ open }) => (
                  <>
                    <Disclosure.Button className="flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
                      <span>Legacy Connections</span>
                      <svg
                        className={`h-4 w-4 ${open ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </Disclosure.Button>
                    <Disclosure.Panel>
                      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-8 px-4 pb-8 sm:grid-cols-3 sm:gap-x-8 sm:px-4">
                        {legacySources.map((file) => (
                          <li key={file.source} className="relative">
                            <div
                              className={`aspect-h-7 aspect-w-10 focus-within:ring-primary-500 group block w-full overflow-hidden rounded-lg transition-all focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 ${
                                file.enabled
                                  ? 'bg-primary-700 hover:bg-primary-600 cursor-pointer'
                                  : 'bg-gray-400 cursor-not-allowed'
                              }`}
                              onClick={() => {
                                if (!file.enabled) return;
                                if (IS_DEMO === 'enabled') {
                                  notifyDispatch({
                                    type: 'set_notification',
                                    message:
                                      'Adding new connections is disabled in demo mode',
                                    variant: 'error',
                                  });
                                  return;
                                }
                                dispatch({
                                  type: 'setEmrVendor',
                                  payload: {
                                    vendor: file.vendor,
                                    fhirVersion: file.fhirVersion,
                                  },
                                });
                              }}
                            >
                              <img
                                src={file.source}
                                alt={file.title}
                                className={`pointer-events-none object-cover ${file.enabled ? 'group-hover:opacity-75' : 'opacity-50'}`}
                              />
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
                            {!file.enabled && file.disabledMessage ? (
                              <p className="block text-sm font-medium text-gray-500">
                                {file.disabledMessage}
                              </p>
                            ) : (
                              file.alt && (
                                <p className="pointer-events-none block text-sm font-medium text-gray-700">
                                  {file.alt}
                                </p>
                              )
                            )}
                          </li>
                        ))}
                      </ul>
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
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
                    onClick(
                      s.baseUrl,
                      s.authUrl,
                      s.tokenUrl,
                      s.name,
                      s.id,
                      state.emrVendor,
                      state.fhirVersion,
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
