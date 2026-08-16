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
import {
  describeRequirement,
  EnableRequirement,
  parseVendorConfig,
  VendorChannel,
} from '@mere/shared';
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
  any: {
    R4: '/api/v1/r4/tenants?',
    DSTU2: '/api/v1/dstu2/tenants?',
  },
} as const;

type SearchableVendor = keyof typeof vendorPaths;

export type EMRVendor = Exclude<SearchableVendor, 'any'>;

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

type SearchContext = {
  selection: SearchSelection;
  publicUrl: string;
  sandboxOnly: boolean;
};

type TenantSelectState =
  | { step: 'pickVendor' }
  | {
      step: 'search';
      search: SearchContext;
      query: string;
      results: RemoteData<UnifiedDSTU2Endpoint[]>;
    };

type TenantSelectAction =
  | { type: 'selectVendor'; payload: SearchContext }
  | { type: 'setQuery'; payload: string }
  | { type: 'setResults'; payload: UnifiedDSTU2Endpoint[] }
  | { type: 'searchFailed' }
  | { type: 'reset' };

const defaultState: TenantSelectState = { step: 'pickVendor' };

type DisabledReason =
  | { kind: 'message'; text: string }
  | { kind: 'needsProxy' };

type SourceItem = {
  title: string;
  source: string;
  alt?: string;
  legacy?: boolean;
} & (
  | { enabled: true; activate: () => void }
  | { enabled: false; reason: DisabledReason }
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
    fhirVersion: 'DSTU2' | 'R4',
  ) => void;
}) {
  const userPreferences = useUserPreferences(),
    notifyDispatch = useNotificationDispatch();
  const config = useConfig();

  const vendors = useMemo(() => parseVendorConfig(config), [config]);

  const [state, dispatch] = useReducer(
    (
      state: TenantSelectState,
      action: TenantSelectAction,
    ): TenantSelectState => {
      switch (action.type) {
        case 'selectVendor':
          return {
            step: 'search',
            search: action.payload,
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

  const [vaUrl, setVaUrl] = useState<RemoteData<string>>({
    status: 'loading',
  });

  useEffect(() => {
    getVaLoginUrl(config)
      .then((url) => setVaUrl({ status: 'ok', value: url }))
      .catch(() => setVaUrl({ status: 'error' }));
  }, [config]);

  const ConnectionSources: SourceItem[] = useMemo(() => {
    const missingConfig = (channel: {
      enableWith: EnableRequirement;
    }): DisabledReason => ({
      kind: 'message',
      text: `Provide ${describeRequirement(channel.enableWith)} env var to enable`,
    });

    const searchItem = (
      base: { title: string; source: string; alt?: string; legacy?: boolean },
      selection: SearchSelection,
      channel?: VendorChannel,
    ): SourceItem => {
      if (channel && channel.status === 'disabled') {
        return { ...base, enabled: false, reason: missingConfig(channel) };
      }
      if (vendors.publicUrl.status !== 'configured') {
        return {
          ...base,
          enabled: false,
          reason: {
            kind: 'message',
            text:
              vendors.publicUrl.status === 'invalid'
                ? 'PUBLIC_URL is set but is not a valid URL'
                : 'Provide PUBLIC_URL to enable',
          },
        };
      }
      const search: SearchContext = {
        selection,
        publicUrl: vendors.publicUrl.value,
        sandboxOnly: channel?.status === 'sandbox-only',
      };
      return {
        ...base,
        enabled: true,
        activate: () => dispatch({ type: 'selectVendor', payload: search }),
      };
    };

    const onPatientItem = ((): SourceItem => {
      const base = {
        title: 'OnPatient',
        source: OnpatientLogo,
        alt: 'Dr. Chrono',
      };
      if (vendors.onpatient.status === 'disabled') {
        return {
          ...base,
          enabled: false,
          reason: missingConfig(vendors.onpatient),
        };
      }
      if (!userPreferences?.use_proxy) {
        return { ...base, enabled: false, reason: { kind: 'needsProxy' } };
      }
      const href = buildOnPatientAuthUrl({
        clientId: vendors.onpatient.production.value,
        publicUrl: vendors.onpatient.publicUrl,
        redirectPath: '/api/v1/onpatient/callback',
      });
      return {
        ...base,
        enabled: true,
        activate: () => {
          window.location.href = href;
        },
      };
    })();

    const vaItem = ((): SourceItem => {
      const base = {
        title: 'Veterans Affairs',
        source: VALogo,
        alt: 'Sandbox Only',
      };
      if (vendors.va.status === 'disabled') {
        return { ...base, enabled: false, reason: missingConfig(vendors.va) };
      }
      if (vaUrl.status !== 'ok') {
        return {
          ...base,
          enabled: false,
          reason: {
            kind: 'message',
            text:
              vaUrl.status === 'loading'
                ? 'Preparing VA login...'
                : 'Unable to prepare the VA login',
          },
        };
      }
      const href = vaUrl.value;
      return {
        ...base,
        enabled: true,
        activate: () => {
          window.location.href = href;
        },
      };
    })();

    const athenaItem = ((): SourceItem => {
      const base = { title: 'Athena Health', source: AthenaLogo };
      if (vendors.athena.status === 'disabled') {
        return {
          ...base,
          enabled: false,
          reason: missingConfig(vendors.athena),
        };
      }
      const environment =
        vendors.athena.status === 'production' ? 'production' : 'preview';
      return {
        ...base,
        alt: environment === 'production' ? undefined : 'Sandbox Only',
        enabled: true,
        activate: () => {
          localStorage.setItem(
            AthenaLocalStorageKeys.ATHENA_ENVIRONMENT,
            environment,
          );
          getAthenaLoginUrl(config, environment).then((url) => {
            window.location.href = url;
          });
        },
      };
    })();

    return [
      searchItem(
        {
          title: 'MyChart',
          source: EpicLogo,
          alt:
            vendors.epicR4.status === 'sandbox-only'
              ? 'Sandbox only - set EPIC_CLIENT_ID_R4 for production'
              : undefined,
        },
        { vendor: 'epic', version: 'R4' },
        vendors.epicR4,
      ),
      searchItem(
        { title: 'Cerner', source: CernerLogo },
        { vendor: 'cerner', version: 'R4' },
        vendors.cerner,
      ),
      searchItem(
        { title: 'Allscripts', source: VeradigmLogo, alt: 'Veradigm' },
        { vendor: 'veradigm', version: 'DSTU2' },
        vendors.veradigm,
      ),
      onPatientItem,
      vaItem,
      searchItem(
        { title: 'Healow', source: HealowLogo, alt: 'eClinicalWorks' },
        { vendor: 'healow', version: 'R4' },
        vendors.healow,
      ),
      athenaItem,
      searchItem(
        {
          title: 'Search All',
          source: '',
          alt: 'Search all supported health systems',
        },
        { vendor: 'any', version: 'R4' },
      ),
      searchItem(
        {
          title: 'Search All Legacy',
          source: '',
          alt: 'Search all supported legacy health systems',
          legacy: true,
        },
        { vendor: 'any', version: 'DSTU2' },
      ),
      searchItem(
        { title: 'Cerner Legacy', source: CernerLogo, legacy: true },
        { vendor: 'cerner', version: 'DSTU2' },
        vendors.cerner,
      ),
      searchItem(
        {
          title: 'MyChart Legacy',
          source: EpicLogo,
          legacy: true,
          alt:
            vendors.epicDstu2.status === 'sandbox-only'
              ? 'Sandbox only - set EPIC_CLIENT_ID_DSTU2 for production'
              : undefined,
        },
        { vendor: 'epic', version: 'DSTU2' },
        vendors.epicDstu2,
      ),
    ];
  }, [config, userPreferences?.use_proxy, vaUrl, vendors]);

  const mainSources = useMemo(
    () => ConnectionSources.filter((s) => !s.legacy),
    [ConnectionSources],
  );

  const legacySources = useMemo(
    () => ConnectionSources.filter((s) => s.legacy),
    [ConnectionSources],
  );

  const search = state.step === 'search' ? state.search : null;
  const query = state.step === 'search' ? state.query : '';

  useEffect(() => {
    if (!search) return;

    const params: Record<string, string> = { query };
    if (search.sandboxOnly) {
      params['sandboxOnly'] = 'true';
    }

    const abortController = new AbortController();
    fetch(
      search.publicUrl +
        getApiPath(search.selection) +
        new URLSearchParams(params),
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
  }, [search, query, notifyDispatch]);

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
                        file.activate();
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
                    {!file.enabled ? (
                      file.reason.kind === 'message' ? (
                        <p className="block text-sm font-medium text-gray-500">
                          {file.reason.text}
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
                      file.alt && (
                        <p className="pointer-events-none block text-sm font-medium text-gray-700">
                          {file.alt}
                        </p>
                      )
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
                                file.activate();
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
                            {!file.enabled
                              ? file.reason.kind === 'message' && (
                                  <p className="block text-sm font-medium text-gray-500">
                                    {file.reason.text}
                                  </p>
                                )
                              : file.alt && (
                                  <p className="pointer-events-none block text-sm font-medium text-gray-700">
                                    {file.alt}
                                  </p>
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
                      state.search.selection.vendor === 'any'
                        ? s.vendor && wireVendorMap[s.vendor]
                        : state.search.selection.vendor;
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
                      state.search.selection.version,
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
