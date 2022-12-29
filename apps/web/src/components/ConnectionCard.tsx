import { useCallback, useEffect, useState } from 'react';
import { BaseDocument } from '../models/BaseDocument';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import onpatientLogo from '../img/onpatient_logo.jpeg';
import epicLogo from '../img/MyChartByEpic.png';
import { differenceInDays, format, parseISO } from 'date-fns';
import { RxDatabase, RxDocument } from 'rxdb';
import * as OnPatient from '../services/OnPatient';
import * as Epic from '../services/Epic';
import { useNotificationDispatch } from '../services/NotificationContext';

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
  baseUrl: string
) {
  switch (connectionDocument.get('source')) {
    case 'onpatient': {
      return await OnPatient.syncAllRecords(connectionDocument, db);
    }
    case 'epic': {
      try {
        await refreshConnectionTokenIfNeeded(connectionDocument, db);
        return await Epic.syncAllRecords(baseUrl, connectionDocument, db);
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
  db: RxDatabase<DatabaseCollections>
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_in') <= nowInSeconds) {
    try {
      const epicUrl = connectionDocument.get('location'),
        epicName = connectionDocument.get('name'),
        clientId = connectionDocument.get('client_id'),
        epicId = connectionDocument.get('tenant_id');

      let access_token_data;
      try {
        access_token_data = await Epic.fetchAccessTokenUsingJWT(
          clientId,
          epicUrl
        );
      } catch (e) {
        access_token_data = await Epic.fetchAccessTokenUsingJWT(
          clientId,
          epicUrl,
          epicId,
          true
        );
      }

      return await Epic.saveConnectionToDb({
        res: access_token_data,
        epicUrl,
        epicName,
        db,
        epicId,
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
    removeDocument = (document: BaseDocument) => {
      db.remove().then(() => {
        console.log('db deleted');
      });
    },
    [syncing, setSyncing] = useState(false),
    notifyDispatch = useNotificationDispatch(),
    handleFetchData = useCallback(() => {
      setSyncing(true);
      fetchMedicalRecords(item, db, baseUrl)
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
    }, [baseUrl, db, item, notifyDispatch]);

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
      key={item._id}
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
            className="flex w-0 flex-1"
            onClick={() => removeDocument(item)}
          >
            <div className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center rounded-bl-lg border border-transparent py-4 text-sm font-medium text-gray-700 hover:text-gray-500">
              <span className="ml-3">Disconnect Source</span>
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
                {syncing ? <LoadingSpinner /> : null}
              </span>
            </div>
          </button>
        </div>
      </div>
    </li>
  );
}

function LoadingSpinner() {
  return (
    <div role="status">
      <svg
        aria-hidden="true"
        className="fill-primary-700 mr-2 h-4 w-4 animate-spin text-gray-200 dark:text-gray-600"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
