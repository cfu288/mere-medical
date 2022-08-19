import { useEffect, useState } from 'react';
import { BaseDocument } from '../models/BaseDocument';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import image from '../img/onpatient_logo.jpeg';
import { differenceInDays, format, parseISO } from 'date-fns';
import { RxDatabase, RxDocument } from 'rxdb';

export function ConnectionCard({
  item,
  getList,
  refreshToken,
  fetchData,
}: {
  item: RxDocument<ConnectionDocument>;
  getList: () => void;
  fetchData: (
    connectionDocument: RxDocument<ConnectionDocument>,
    db: RxDatabase<DatabaseCollections>
  ) => Promise<any>;
  refreshToken: (
    refToken: string,
    lastDoc: RxDocument<ConnectionDocument>
  ) => void;
}) {
  const db = useRxDb(),
    removeDocument = (document: BaseDocument) => {
      db.remove().then(() => {
        console.log('db deleted');
      });
    },
    [syncing, setSyncing] = useState(false);

  useEffect(() => {
    console.log(item.toJSON());
    if (!item.get('last_refreshed')) {
      setSyncing(true);
      fetchData(item, db)
        .then(() => {
          setSyncing(false);
        })
        .catch(() => {
          setSyncing(false);
        });
    }
  }, [db, fetchData, item]);

  return (
    <li
      key={item._id}
      className="col-span-1 bg-white rounded-lg shadow divide-y divide-gray-200"
    >
      <div className="w-full flex items-center justify-between p-6 space-x-6">
        <img
          className="w-10 h-10 bg-gray-300 rounded-full flex-shrink-0"
          src={image}
          alt=""
        />
        <div className="flex-1 truncate">
          <div className="flex items-center space-x-3">
            <h3 className="text-gray-900 text-sm font-medium truncate uppercase">
              {item.get('source')}
            </h3>
          </div>
          <p className="mt-1 text-gray-500 text-sm truncate">
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
          <div className="w-0 flex-1 flex" onClick={() => removeDocument(item)}>
            <div className="relative -mr-px w-0 flex-1 inline-flex items-center justify-center py-4 text-sm text-gray-700 font-medium border border-transparent rounded-bl-lg hover:text-gray-500">
              <span className="ml-3">disconnect</span>
            </div>
          </div>
          <div
            className="-ml-px w-0 flex-1 flex divide-x divide-gray-200"
            onClick={() => refreshToken(item.refresh_token, item)}
          >
            <a className="relative w-0 flex-1 inline-flex items-center justify-center py-4 text-sm text-gray-700 font-medium border border-transparent rounded-br-lg hover:text-gray-500">
              <span className="ml-3">refresh</span>
            </a>
          </div>
          <button
            disabled={syncing}
            className={`-ml-px w-0 divide-x divide-gray-200 flex-1 flex ${
              syncing ? 'disabled:bg-slate-50' : ''
            }`}
            onClick={() => {
              setSyncing(true);
              fetchData(item, db)
                .then(() => {
                  setSyncing(false);
                })
                .catch((e) => {
                  alert(`Error: ${e}`);
                  console.error(e);
                  setSyncing(false);
                });
            }}
          >
            <div className="relative w-0 flex-1 inline-flex items-center justify-center py-4 text-sm text-gray-700 font-medium border border-transparent rounded-br-lg hover:text-gray-500">
              sync
              <span className="ml-3">
                {syncing ? (
                  <div role="status">
                    <svg
                      aria-hidden="true"
                      className="mr-2 w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
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
                ) : (
                  <></>
                )}
              </span>
            </div>
          </button>
        </div>
      </div>
    </li>
  );
}
