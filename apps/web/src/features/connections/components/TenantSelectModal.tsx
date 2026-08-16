/* eslint-disable react/jsx-no-useless-fragment */
import { memo, useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';

import { Combobox, Disclosure } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { DSTU2Endpoint as CernerDSTU2Endpoint } from '@mere/cerner';
import { DSTU2Endpoint as EpicDSTU2Endpoint } from '@mere/epic';
import { DSTU2Endpoint as VeradigmDSTU2Endpoint } from '@mere/veradigm';
import { buildOnPatientAuthUrl } from '@mere/fhir-oauth';

import VeradigmLogo from '../../../assets/img/allscripts-logo.png';
import CernerLogo from '../../../assets/img/cerner-logo.png';
import EpicLogo from '../../../assets/img/mychart-logo.png';
import OnpatientLogo from '../../../assets/img/onpatient-logo-full.webp';
import { Routes } from '../../../Routes';
import { Modal } from '../../../shared/components/Modal';
import { ModalHeader } from '../../../shared/components/ModalHeader';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { useUserPreferences } from '../../../app/providers/UserPreferencesProvider';
import { getLoginUrl as getVaLoginUrl } from '../../../services/fhir/VA';
import {
  SelectOption,
  SkeletonTenantSelectModalResultItem,
  TenantSelectModelResultItem,
  TenantWireVendor,
} from './TenantSelectModelResultItem';
import VALogo from '../../../assets/img/va-logo.png';
import HealowLogo from '../../../assets/img/eclinicalworks-logo.jpeg';
import AthenaLogo from '../../../assets/img/athena-logo.jpeg';
import { useConfig } from '../../../app/providers/AppConfigProvider';
import { parseVendorConfig } from '@mere/shared';
import {
  AthenaLocalStorageKeys,
  getLoginUrl as getAthenaLoginUrl,
} from '../../../services/fhir/Athena';

export type FhirVersion = 'DSTU2' | 'R4';

const vendorPaths = {
  epic: {
    R4: '/api/v1/epic/r4/tenants?',
    DSTU2: '/api/v1/epic/tenants?',
  },
  cerner: {
    R4: '/api/v1/cerner/r4/tenants?',
    DSTU2: '/api/v1/cerner/tenants?',
  },
  healow: {
    R4: '/api/v1/healow/tenants?',
  },
  veradigm: {
    DSTU2: '/api/v1/veradigm/tenants?',
  },
  onpatient: {
    DSTU2: '/api/v1/onpatient/tenants?',
  },
  va: {
    DSTU2: '/api/v1/va/tenants?',
  },
  any: {
    R4: '/api/v1/r4/tenants?',
    DSTU2: '/api/v1/dstu2/tenants?',
  },
} as const;

type SearchableVendor = keyof typeof vendorPaths;

export type EMRVendor = SearchableVendor | 'athena';

type SearchSelection = {
  [V in SearchableVendor]: {
    vendor: V;
    version: keyof (typeof vendorPaths)[V];
  };
}[SearchableVendor];

function getApiPath(selection: SearchSelection): string {
  switch (selection.vendor) {
    case 'epic':
      return vendorPaths.epic[selection.version];
    case 'cerner':
      return vendorPaths.cerner[selection.version];
    case 'healow':
      return vendorPaths.healow[selection.version];
    case 'veradigm':
      return vendorPaths.veradigm[selection.version];
    case 'onpatient':
      return vendorPaths.onpatient[selection.version];
    case 'va':
      return vendorPaths.va[selection.version];
    case 'any': // Search All
      return vendorPaths.any[selection.version];
  }
}

const wireVendorMap: Record<TenantWireVendor, EMRVendor> = {
  EPIC: 'epic',
  CERNER: 'cerner',
  VERADIGM: 'veradigm',
  HEALOW: 'healow',
};

export type UnifiedDSTU2Endpoint = CernerDSTU2Endpoint &
  EpicDSTU2Endpoint &
  VeradigmDSTU2Endpoint & { vendor: TenantWireVendor };

type RemoteData<T> =
  | { status: 'loading' }
  | { status: 'ok'; value: T }
  | { status: 'error' };

type TenantSelectState =
  | { step: 'pickVendor' }
  | {
      step: 'search';
      selection: SearchSelection;
      query: string;
      results: RemoteData<UnifiedDSTU2Endpoint[]>;
    };

type TenantSelectAction =
  | { type: 'selectVendor'; payload: SearchSelection }
  | { type: 'setQuery'; payload: string }
  | { type: 'setResults'; payload: UnifiedDSTU2Endpoint[] }
  | { type: 'searchFailed' }
  | { type: 'reset' };

const defaultState: TenantSelectState = { step: 'pickVendor' };

type SourceItem = {
  title: string;
  source: string;
  alt?: string;
  enabled: boolean;
  disabledMessage?: string;
  legacy?: boolean;
} & (
  | { kind: 'search'; selection: SearchSelection }
  | { kind: 'link'; href: string }
  | { kind: 'direct'; onSelect: () => void }
);

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

  const vendors = useMemo(() => parseVendorConfig(config), [config]);

  const epicR4Enabled = vendors.epicR4.status !== 'disabled';
  const epicR4SandboxOnly = vendors.epicR4.status === 'sandbox-only';
  const epicDstu2Enabled = vendors.epicDstu2.status !== 'disabled';
  const epicDstu2SandboxOnly = vendors.epicDstu2.status === 'sandbox-only';
  const cernerEnabled = vendors.cerner.status !== 'disabled';
  const veradigmEnabled = vendors.veradigm.status !== 'disabled';
  const vaEnabled = vendors.va.status !== 'disabled';
  const healowEnabled = vendors.healow.status !== 'disabled';
  const athenaProductionEnabled = vendors.athena.status === 'production';
  const athenaEnabled = vendors.athena.status !== 'disabled';

  const [state, dispatch] = useReducer(
    (
      state: TenantSelectState,
      action: TenantSelectAction,
    ): TenantSelectState => {
      switch (action.type) {
        case 'selectVendor':
          return {
            step: 'search',
            selection: action.payload,
            query: '',
            results: { status: 'loading' },
          };
        case 'setQuery':
          if (state.step !== 'search') return state;
          return { ...state, query: action.payload };
        case 'setResults':
          if (state.step !== 'search') return state;
          return { ...state, results: { status: 'ok', value: action.payload } };
        case 'searchFailed':
          if (state.step !== 'search') return state;
          return { ...state, results: { status: 'error' } };
        case 'reset':
          return defaultState;
        default:
          return state;
      }
    },
    defaultState,
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
    const sources: SourceItem[] = [
      {
        title: 'MyChart',
        kind: 'search',
        selection: { vendor: 'epic', version: 'R4' },
        source: EpicLogo,
        alt: epicR4SandboxOnly
          ? 'Sandbox only - set EPIC_CLIENT_ID_R4 for production'
          : undefined,
        enabled: epicR4Enabled,
        disabledMessage:
          'Provide EPIC_CLIENT_ID_R4 or EPIC_SANDBOX_CLIENT_ID_R4 env var to enable',
      },
      {
        title: 'Cerner',
        kind: 'search',
        selection: { vendor: 'cerner', version: 'R4' },
        source: CernerLogo,
        enabled: cernerEnabled,
        disabledMessage: 'Provide CERNER_CLIENT_ID env var to enable',
      },
      {
        title: 'Allscripts',
        kind: 'search',
        selection: { vendor: 'veradigm', version: 'DSTU2' },
        source: VeradigmLogo,
        alt: 'Veradigm',
        enabled: veradigmEnabled,
        disabledMessage: 'Provide VERADIGM_CLIENT_ID env var to enable',
      },
      {
        title: 'OnPatient',
        kind: 'link',
        source: OnpatientLogo,
        alt: 'Dr. Chrono',
        href: buildOnPatientAuthUrl({
          clientId: config.ONPATIENT_CLIENT_ID || '',
          publicUrl: config.PUBLIC_URL || '',
          redirectPath: '/api/v1/onpatient/callback',
        }),
        enabled:
          vendors.onpatient.status !== 'disabled' &&
          !!userPreferences?.use_proxy,
        disabledMessage:
          vendors.onpatient.status === 'disabled'
            ? `Provide ${vendors.onpatient.enableWith.join(' or ')} to enable`
            : undefined,
      },
      {
        title: 'Veterans Affairs',
        kind: 'link',
        source: VALogo,
        alt: 'Sandbox Only',
        href: vaUrl,
        enabled: vaEnabled,
        disabledMessage: 'Provide VA_CLIENT_ID env var to enable',
      },
      {
        title: 'Healow',
        kind: 'search',
        selection: { vendor: 'healow', version: 'R4' },
        source: HealowLogo,
        alt: 'eClinicalWorks',
        enabled: healowEnabled,
        disabledMessage: 'Provide HEALOW_CLIENT_ID env var to enable',
      },
      {
        title: 'Athena Health',
        kind: 'direct',
        source: AthenaLogo,
        alt: athenaProductionEnabled ? undefined : 'Sandbox Only',
        enabled: athenaEnabled,
        disabledMessage: 'Provide ATHENA_CLIENT_ID env var to enable',
        onSelect: () => {
          const environment = athenaProductionEnabled
            ? 'production'
            : 'preview';
          localStorage.setItem(
            AthenaLocalStorageKeys.ATHENA_ENVIRONMENT,
            environment,
          );
          getAthenaLoginUrl(config, environment).then((url) => {
            window.location.href = url;
          });
        },
      },
      {
        title: 'Search All',
        kind: 'search',
        selection: { vendor: 'any', version: 'R4' },
        source: '',
        alt: 'Search all supported health systems',
        enabled: true,
      },
      {
        title: 'Search All Legacy',
        kind: 'search',
        selection: { vendor: 'any', version: 'DSTU2' },
        source: '',
        alt: 'Search all supported legacy health systems',
        enabled: true,
        legacy: true,
      },
      {
        title: 'Cerner Legacy',
        kind: 'search',
        selection: { vendor: 'cerner', version: 'DSTU2' },
        source: CernerLogo,
        enabled: cernerEnabled,
        disabledMessage: 'Provide CERNER_CLIENT_ID env var to enable',
        legacy: true,
      },
      {
        title: 'MyChart Legacy',
        kind: 'search',
        selection: { vendor: 'epic', version: 'DSTU2' },
        source: EpicLogo,
        alt: epicDstu2SandboxOnly
          ? 'Sandbox only - set EPIC_CLIENT_ID_DSTU2 for production'
          : undefined,
        enabled: epicDstu2Enabled,
        disabledMessage:
          'Provide EPIC_CLIENT_ID_DSTU2 or EPIC_SANDBOX_CLIENT_ID_DSTU2 env var to enable',
        legacy: true,
      },
    ];

    return sources;
  }, [
    config,
    userPreferences?.use_proxy,
    vaUrl,
    vendors,
    epicR4Enabled,
    epicR4SandboxOnly,
    epicDstu2Enabled,
    epicDstu2SandboxOnly,
    cernerEnabled,
    veradigmEnabled,
    vaEnabled,
    healowEnabled,
    athenaEnabled,
    athenaProductionEnabled,
  ]);

  const mainSources = useMemo(
    () => ConnectionSources.filter((s) => !s.legacy),
    [ConnectionSources],
  );

  const legacySources = useMemo(
    () => ConnectionSources.filter((s) => s.legacy),
    [ConnectionSources],
  );

  const selection = state.step === 'search' ? state.selection : null;
  const query = state.step === 'search' ? state.query : '';

  useEffect(() => {
    if (!selection) return;

    if (!config.PUBLIC_URL) {
      notifyDispatch({
        type: 'set_notification',
        message: 'Configuration not loaded. Please try again.',
        variant: 'error',
      });
      dispatch({ type: 'searchFailed' });
      return;
    }

    // Epic provides separate client ids for sandbox only, we detect it here so we can provide conditional rendering later depending on which env variables are provided
    const epicSandboxOnly =
      selection.vendor === 'epic' &&
      (selection.version === 'R4' ? epicR4SandboxOnly : epicDstu2SandboxOnly);

    const params: Record<string, string> = { query };
    if (epicSandboxOnly) {
      params['sandboxOnly'] = 'true';
    }

    const abortController = new AbortController();
    fetch(
      config.PUBLIC_URL + getApiPath(selection) + new URLSearchParams(params),
      {
        signal: abortController.signal,
      },
    )
      .then((x) => x.json())
      .then((x) => dispatch({ type: 'setResults', payload: x }))
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        notifyDispatch({
          type: 'set_notification',
          message: `Unable to search for health systems`,
          variant: 'error',
        });
        dispatch({ type: 'searchFailed' });
      });

    return () => {
      abortController.abort();
    };
  }, [
    selection,
    query,
    notifyDispatch,
    config.PUBLIC_URL,
    epicR4SandboxOnly,
    epicDstu2SandboxOnly,
  ]);

  return (
    <Modal
      open={open}
      setOpen={setOpen}
      afterLeave={() => {
        dispatch({ type: 'reset' });
      }}
      overflowXHidden
      flex
    >
      <>
        {state.step === 'pickVendor' ? (
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
                  <li key={file.title} className="relative">
                    {file.kind === 'link' ? (
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
                          window.location.href = file.href;
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
                            if (file.kind === 'direct') {
                              file.onSelect();
                            } else {
                              dispatch({
                                type: 'selectVendor',
                                payload: file.selection,
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
                          <li key={file.title} className="relative">
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
                                if (file.kind !== 'search') return;
                                dispatch({
                                  type: 'selectVendor',
                                  payload: file.selection,
                                });
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
                dispatch({ type: 'reset' });
              }}
            />
            {state.results.status === 'loading' ? (
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
                    // Cross-vendor searches resolve the concrete vendor from
                    // the selected tenant itself
                    const vendor =
                      state.selection.vendor === 'any'
                        ? s.vendor && wireVendorMap[s.vendor]
                        : state.selection.vendor;
                    if (!vendor) {
                      notifyDispatch({
                        type: 'set_notification',
                        message: 'Unable to connect to this health system',
                        variant: 'error',
                      });
                      return;
                    }
                    onClick(
                      s.baseUrl,
                      s.authUrl,
                      s.tokenUrl,
                      s.name,
                      s.id,
                      vendor,
                      state.selection.version,
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
                  {state.results.status === 'ok' &&
                    state.results.value.length > 0 && (
                      <Combobox.Options
                        static
                        className="max-h-full scroll-py-3 overflow-y-scroll p-3 sm:max-h-96"
                      >
                        {state.results.value.map((item) => (
                          <MemoizedResultItem
                            key={item.id}
                            id={item.id}
                            name={item.name}
                            baseUrl={item.url}
                            tokenUrl={item.token}
                            authUrl={item.authorize}
                            vendor={item.vendor}
                          />
                        ))}
                      </Combobox.Options>
                    )}
                  {state.query !== '' &&
                    (state.results.status === 'error' ||
                      (state.results.status === 'ok' &&
                        state.results.value.length === 0)) && (
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
                          No health system found for this search term. Please
                          try again.
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
