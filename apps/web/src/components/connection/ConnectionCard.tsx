import { useCallback, useState } from 'react';
import {
  ConnectionDocument,
  ConnectionSources,
} from '../../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../providers/RxDbProvider';
import onpatientLogo from '../../img/onpatient_logo.jpeg';
import epicLogo from '../../img/MyChartByEpic.png';
import cernerLogo from '../../img/cerner-logo.png';
import allscriptsConnectLogo from '../../img/allscripts-logo.png';
import { differenceInDays, format, parseISO } from 'date-fns';
import { RxDocument } from 'rxdb';
import { useNotificationDispatch } from '../providers/NotificationProvider';
import { useUserPreferences } from '../providers/UserPreferencesProvider';
import { useUser } from '../providers/UserProvider';
import { ButtonLoadingSpinner } from './ButtonLoadingSpinner';
import {
  useSyncJobContext,
  useSyncJobDispatchContext,
} from '../providers/SyncJobProvider';
import { AbnormalResultIcon } from '../timeline/AbnormalResultIcon';
import {
  getLoginUrlBySource,
  setTenantUrlBySource,
} from '../../pages/ConnectionTab';
import React from 'react';
import { get } from 'http';

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
    user = useUser(),
    [deleting, setDeleting] = useState(false),
    userPreferences = useUserPreferences(),
    removeDocument = (document: RxDocument<ConnectionDocument>) => {
      setDeleting(true);
      const connectionId = document.get('id');
      db.clinical_documents
        .find({
          selector: {
            user_id: user.id,
            connection_record_id: connectionId,
          },
        })
        .remove()
        .then(() => {
          document.remove();
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
    notifyDispatch = useNotificationDispatch(),
    sync = useSyncJobContext(),
    syncD = useSyncJobDispatchContext(),
    syncJobEntries = new Set(Object.keys(sync)),
    syncing = syncJobEntries.has(item.get('id')),
    handleFetchData = useCallback(() => {
      if (syncD && userPreferences) {
        syncD({
          type: 'add_job',
          id: item.toJSON().id,
          connectionDocument: item,
          baseUrl,
          useProxy: userPreferences.use_proxy,
          db,
        });
      }
    }, [baseUrl, db, item, syncD, userPreferences]);

  return (
    <li
      key={item.id}
      className="col-span-1 mb-8 divide-y divide-gray-200 rounded-lg bg-white shadow"
    >
      <div className="flex w-full items-center justify-between space-x-6 p-6">
        <img
          className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-300"
          src={getImage(item.get('source'))}
          alt=""
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
                  item.get('last_refreshed')
                )}{' '}
              </p>
            </div>
          ) : (
            <p className="mt-1 truncate text-sm font-medium text-gray-500">
              Connected
              {item.get('last_refreshed') &&
                formatConnectedTimestampText(item.get('last_refreshed'))}
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
            onClick={() => removeDocument(item)}
          >
            <div className="relative -mr-px inline-flex h-full w-0 flex-1 items-center justify-center rounded-bl-lg border border-transparent px-1 py-4 text-sm font-medium text-gray-700 hover:text-gray-500">
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
            <div className="relative inline-flex h-full w-0 flex-1 items-center justify-center rounded-br-lg border border-transparent py-4 text-sm font-medium text-gray-700 hover:text-gray-500">
              Sync
              <span className="ml-3">
                {syncing ? <ButtonLoadingSpinner /> : null}
              </span>
            </div>
          </button>
          {item.get('last_sync_was_error') ? (
            // redirect to href
            <button
              disabled={syncing}
              className="-ml-px flex flex-initial divide-x divide-gray-800 px-4 disabled:bg-slate-50"
              onClick={() => {
                setTenantUrlBySource(item);
                window.location = getLoginUrlBySource(item);
              }}
            >
              <div className="relative inline-flex h-full flex-initial items-center justify-center rounded-br-lg border border-transparent py-4 text-sm font-bold text-red-500 hover:text-gray-500">
                Fix
              </div>
            </button>
          ) : null}
        </div>
      </div>
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
        isoDate
      )} at ${formatTimestampToTime(isoDate)}`
    : ` Unable to sync since ${formatTimestampToTime(isoDate)}`;
}

function formatTimestampToDay(isoDate: string) {
  return format(parseISO(isoDate), 'MMM dd');
}

function formatTimestampToTime(isoDate: string) {
  return format(parseISO(isoDate), 'p');
}
