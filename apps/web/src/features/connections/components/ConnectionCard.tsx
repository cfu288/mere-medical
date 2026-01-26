import { useCallback, useEffect, useState } from 'react';
import {
  ConnectionDocument,
  ConnectionSources,
} from '../../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import onpatientLogo from '../../../assets/img/onpatient-logo.jpeg';
import epicLogo from '../../../assets/img/MyChartByEpic.png';
import cernerLogo from '../../../assets/img/cerner-logo.png';
import allscriptsConnectLogo from '../../../assets/img/allscripts-logo.png';
import vaLogo from '../../../assets/img/va-logo.png';
import healowLogo from '../../../assets/img/ecw-logo.png';
import { differenceInDays, format, parseISO } from 'date-fns';
import { RxDocument } from 'rxdb';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { useUserPreferences } from '../../../app/providers/UserPreferencesProvider';
import { useUser } from '../../../app/providers/UserProvider';
import {
  useConfig,
  isConfigValid,
} from '../../../app/providers/AppConfigProvider';
import { ButtonLoadingSpinner } from './ButtonLoadingSpinner';
import {
  useSyncJobContext,
  useSyncJobDispatchContext,
} from '../../sync/SyncJobProvider';
import { AbnormalResultIcon } from '../../timeline/components/AbnormalResultIcon';
import { getLoginUrlBySource, setTenantUrlBySource } from '../ConnectionTab';
import React from 'react';
import { Modal } from '../../../shared/components/Modal';
import { ModalHeader } from '../../../shared/components/ModalHeader';
import { deleteConnectionWithCascade } from '../../../services/fhir/ConnectionService';

function getImage(logo: ConnectionSources) {
  switch (logo) {
    case 'onpatient': {
      return onpatientLogo;
    }
    case 'epic': {
      return epicLogo;
    }
    case 'cerner': {
      return cernerLogo;
    }
    case 'veradigm': {
      return allscriptsConnectLogo;
    }
    case 'va': {
      return vaLogo;
    }
    case 'healow': {
      return healowLogo;
    }
    default: {
      return undefined;
    }
  }
}

export function ConnectionCard({
  item,
  baseUrl,
}: {
  item: RxDocument<ConnectionDocument>;
  baseUrl: string;
}) {
  const db = useRxDb(),
    config = useConfig(),
    user = useUser(),
    [deleting, setDeleting] = useState(false),
    userPreferences = useUserPreferences(),
    notifyDispatch = useNotificationDispatch(),
    sync = useSyncJobContext(),
    syncD = useSyncJobDispatchContext(),
    syncJobEntries = new Set(Object.keys(sync)),
    syncing = syncJobEntries.has(item.get('id')),
    removeDocument = (document: RxDocument<ConnectionDocument>) => {
      setDeleting(true);
      const connectionId = document.get('id');

      if (syncD && syncJobEntries.has(connectionId)) {
        syncD({ type: 'remove_job', id: connectionId });
      }

      deleteConnectionWithCascade(db, user.id, connectionId)
        .then(() => {
          setDeleting(false);
          notifyDispatch({
            type: 'set_notification',
            message: `Successfully removed connection`,
            variant: 'success',
          });
        })
        .catch((e) => {
          console.error(e);
          setDeleting(false);
          notifyDispatch({
            type: 'set_notification',
            message: `Error removing connection: ${e.message}`,
            variant: 'error',
          });
        });
    },
    handleFetchData = useCallback(() => {
      if (!isConfigValid(config)) {
        notifyDispatch({
          type: 'set_notification',
          message: 'Configuration not loaded. Please refresh the page.',
          variant: 'error',
        });
        return;
      }
      if (syncD && userPreferences) {
        syncD({
          type: 'add_job',
          config,
          id: item.toJSON().id,
          connectionDocument: item,
          baseUrl,
          useProxy: userPreferences.use_proxy,
          db,
        });
      }
    }, [baseUrl, config, db, item, notifyDispatch, syncD, userPreferences]);

  const [showModal, setShowModal] = useState(false);
  const [showPeriodText, setShowPeriodText] = useState('...');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (syncing) {
      interval = setInterval(() => {
        if (showPeriodText === '...') {
          setShowPeriodText('.');
        } else if (showPeriodText === '.') {
          setShowPeriodText('..');
        } else if (showPeriodText === '..') {
          setShowPeriodText('...');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showPeriodText, syncing]);

  return (
    <li
      key={item.id}
      className="col-span-1 mb-8 divide-y divide-gray-200 rounded-lg bg-white shadow"
    >
      <div className="flex w-full items-center justify-between space-x-6 p-6">
        <img
          className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-300"
          src={getImage(item.get('source'))}
          alt={`${item.get('source')} logo`}
        />
        <div className="flex-1 truncate">
          <div className="flex items-center space-x-3">
            <h3 className="truncate text-sm font-semibold  text-gray-900">
              {item.get('source') === 'epic'
                ? `MyChart - ${item.get('name')}`
                : item.get('source') === 'cerner'
                  ? `Cerner - ${item.get('name')}`
                  : item.get('source') === 'veradigm'
                    ? `Veradigm - ${item.get('name')}`
                    : item.get('name')}
            </h3>
          </div>
          {item.get('last_sync_was_error') ? (
            <div className="mt-1 flex flex-row items-center truncate align-middle text-sm font-medium text-red-500">
              <AbnormalResultIcon />
              <p className="pl-1">
                {formatErrorLastAttemptTimestampText(
                  item.get('last_refreshed'),
                )}{' '}
              </p>
            </div>
          ) : (
            <p className="mt-1 truncate text-sm font-medium text-gray-800">
              {syncing
                ? `Syncing now${showPeriodText}`
                : `Connected ${
                    item.get('last_refreshed')
                      ? formatConnectedTimestampText(item.get('last_refreshed'))
                      : ''
                  }`}
            </p>
          )}
        </div>
      </div>
      <div>
        <div className="-mt-px flex divide-x divide-gray-200">
          <button
            disabled={deleting}
            className={`flex w-0 flex-1 ${
              deleting ? 'disabled:bg-slate-50' : ''
            }`}
            onClick={() => setShowModal(true)}
          >
            <div className="relative -mr-px inline-flex h-full w-0 flex-1 items-center justify-center rounded-bl-lg border border-transparent px-1 py-4 text-sm font-medium text-gray-800 hover:text-gray-800">
              Disconnect Source
              {deleting ? (
                <span className="ml-3">
                  <ButtonLoadingSpinner />
                </span>
              ) : null}
            </div>
          </button>
          <button
            disabled={syncing}
            className="-ml-px flex w-0 flex-1 divide-x divide-gray-800 disabled:bg-slate-50"
            onClick={handleFetchData}
          >
            <div className="relative inline-flex h-full w-0 flex-1 items-center justify-center rounded-br-lg border border-transparent py-4 text-sm font-medium text-gray-800 hover:text-gray-800">
              Sync
              <span className="ml-3">
                {syncing ? <ButtonLoadingSpinner /> : null}
              </span>
            </div>
          </button>
          {item.get('last_sync_was_error') ? (
            <button
              disabled={syncing}
              className="-ml-px flex flex-initial divide-x divide-gray-800 px-4 disabled:bg-slate-50"
              onClick={async () => {
                if (!isConfigValid(config)) {
                  notifyDispatch({
                    type: 'set_notification',
                    message:
                      'Configuration not loaded. Please refresh the page.',
                    variant: 'error',
                  });
                  return;
                }
                setTenantUrlBySource(item);
                window.location = await getLoginUrlBySource(config, item);
              }}
            >
              <div className="relative inline-flex h-full flex-initial items-center justify-center rounded-br-lg border border-transparent py-4 text-sm font-bold text-red-500 hover:text-gray-800">
                Fix
              </div>
            </button>
          ) : null}
        </div>
      </div>
      {/* Add confirm modal before delete: Are you sure you want to remove this connection? */}
      <Modal
        open={showModal}
        setOpen={setShowModal}
        overflowHidden
        overflowXHidden
      >
        <ModalHeader
          title="Remove Connection"
          subtitle="Are you sure you want to remove this connection?"
          setClose={(x: boolean) => setShowModal(x)}
        />
        <div className="m-4 flex justify-end">
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => setShowModal(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ml-3 inline-flex justify-center rounded-md border border-red-300 bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600"
            onClick={() => {
              removeDocument(item);
              setShowModal(false);
            }}
          >
            Remove
          </button>
        </div>
      </Modal>
    </li>
  );
}

function formatConnectedTimestampText(isoDate: string) {
  return Math.abs(differenceInDays(parseISO(isoDate), new Date())) >= 1
    ? ` - synced on ${formatTimestampToDay(isoDate)}`
    : ` - synced at 
          ${formatTimestampToTime(isoDate)}`;
}

function formatErrorLastAttemptTimestampText(isoDate: string) {
  if (!isoDate) {
    return `Unable to sync`;
  }
  return Math.abs(differenceInDays(parseISO(isoDate), new Date())) >= 1
    ? ` Unable to sync since ${formatTimestampToDay(
        isoDate,
      )} at ${formatTimestampToTime(isoDate)}`
    : ` Unable to sync since ${formatTimestampToTime(isoDate)}`;
}

function formatTimestampToDay(isoDate: string) {
  return format(parseISO(isoDate), 'MMM dd');
}

function formatTimestampToTime(isoDate: string) {
  return format(parseISO(isoDate), 'p');
}
