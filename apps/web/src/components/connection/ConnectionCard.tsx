import { useCallback, useEffect, useState } from 'react';
import { ConnectionDocument } from '../../models/connection-document/ConnectionDocument.type';
import { DatabaseCollections, useRxDb } from '../providers/RxDbProvider';
import onpatientLogo from '../../img/onpatient_logo.jpeg';
import epicLogo from '../../img/MyChartByEpic.png';
import { differenceInDays, format, parseISO } from 'date-fns';
import { RxDatabase, RxDocument } from 'rxdb';
import * as OnPatient from '../../services/OnPatient';
import * as Epic from '../../services/Epic';
import { useNotificationDispatch } from '../providers/NotificationProvider';
import { useUserPreferences } from '../providers/UserPreferencesProvider';
import { useUser } from '../providers/UserProvider';
import { ButtonLoadingSpinner } from './ButtonLoadingSpinner';

function getImage(logo: 'onpatient' | 'epic') {
  switch (logo) {
    case 'onpatient': {
      return onpatientLogo;
    }
    case 'epic': {
      return epicLogo;
    }
    default: {
      return undefined;
    }
  }
}

async function fetchMedicalRecords(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  baseUrl: string,
  useProxy = false
) {
  switch (connectionDocument.get('source')) {
    case 'onpatient': {
      return await OnPatient.syncAllRecords(connectionDocument, db);
    }
    case 'epic': {
      try {
        await refreshConnectionTokenIfNeeded(connectionDocument, db, useProxy);
        return await Epic.syncAllRecords(
          baseUrl,
          connectionDocument,
          db,
          useProxy
        );
      } catch (e) {
        console.error(e);
        throw new Error('Error refreshing token  - try logging in again');
      }
    }
    default: {
      throw Error(
        `Cannot sync unknown source: ${connectionDocument.get('source')}`
      );
    }
  }
}

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param connectionDocument the connection document to refresh the access token for
 * @param db
 */
async function refreshConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_in') <= nowInSeconds) {
    try {
      const epicUrl = connectionDocument.get('location'),
        epicName = connectionDocument.get('name'),
        clientId = connectionDocument.get('client_id'),
        epicId = connectionDocument.get('tenant_id'),
        user = connectionDocument.get('user_id');

      const access_token_data = await Epic.fetchAccessTokenUsingJWT(
        clientId,
        epicUrl,
        epicId,
        useProxy
      );

      return await Epic.saveConnectionToDb({
        res: access_token_data,
        epicUrl,
        epicName,
        db,
        epicId,
        user,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token  - try logging in again');
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
    [syncing, setSyncing] = useState(false),
    notifyDispatch = useNotificationDispatch(),
    handleFetchData = useCallback(() => {
      setSyncing(true);
      fetchMedicalRecords(item, db, baseUrl, userPreferences?.use_proxy)
        .then(() => {
          setSyncing(false);
        })
        .catch((e) => {
          notifyDispatch({
            type: 'set_notification',
            message: `Error fetching data: ${e.message}`,
            variant: 'error',
          });
          setSyncing(false);
        });
    }, [baseUrl, db, item, notifyDispatch, userPreferences?.use_proxy]);

  useEffect(() => {
    if (
      !item.get('last_refreshed') ||
      (item.get('last_refreshed') &&
        differenceInDays(parseISO(item.get('last_refreshed')), new Date()) >= 1)
    ) {
      handleFetchData();
    }
  }, [baseUrl, db, handleFetchData, item]);

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
                : item.get('name')}
            </h3>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-gray-500">
            Connected
            {item.get('last_refreshed') &&
              (differenceInDays(
                parseISO(item.get('last_refreshed')),
                new Date()
              ) >= 1
                ? ` - synced on ${format(
                    parseISO(item.get('last_refreshed')),
                    'MMM dd'
                  )}`
                : ` - synced at 
          ${format(parseISO(item.get('last_refreshed')), 'p')}`)}
          </p>
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
            <div className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center rounded-bl-lg border border-transparent py-4 text-sm font-medium text-gray-700 hover:text-gray-500">
              Disconnect Source
              <span className="ml-3">
                {deleting ? <ButtonLoadingSpinner /> : null}
              </span>
            </div>
          </button>
          <button
            disabled={syncing}
            className={`-ml-px flex w-0 flex-1 divide-x divide-gray-800 ${
              syncing ? 'disabled:bg-slate-50' : ''
            }`}
            onClick={handleFetchData}
          >
            <div className="relative inline-flex w-0 flex-1 items-center justify-center rounded-br-lg border border-transparent py-4 text-sm font-medium text-gray-700 hover:text-gray-500">
              Sync
              <span className="ml-3">
                {syncing ? <ButtonLoadingSpinner /> : null}
              </span>
            </div>
          </button>
        </div>
      </div>
    </li>
  );
}
