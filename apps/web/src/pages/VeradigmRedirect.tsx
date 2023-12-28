import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import uuid4 from '../utils/UUIDUtils';
import {
  CreateVeradigmConnectionDocument,
  VeradigmConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';
import {
  DatabaseCollections,
  useRxDb,
} from '../components/providers/RxDbProvider';
import { Routes } from '../Routes';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { useUser } from '../components/providers/UserProvider';
import {
  fetchAccessTokenWithCode,
  VeradigmAuthResponse,
  VeradigmLocalStorageKeys,
} from '../services/Veradigm';
import { RxDatabase } from 'rxdb';
import { UserDocument } from '../models/user-document/UserDocument.type';
import { getConnectionCardByUrl } from '../services/getConnectionCardByUrl';
import { set } from 'date-fns';

function removeEndSlash(url: string) {
  if (url?.endsWith('/')) {
    return `${url.substring(0, url.length - 1)}` as string & Location;
  }
  return url as string & Location;
}

export async function saveConnectionToDb({
  res,
  veradigmBaseUrl,
  db,
  user,
  name,
  auth_uri,
  token_uri,
}: {
  res: VeradigmAuthResponse;
  veradigmBaseUrl: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  name: string;
  auth_uri: string;
  token_uri: string;
}) {
  const doc = await getConnectionCardByUrl<VeradigmConnectionDocument>(
    veradigmBaseUrl,
    db
  );
  return new Promise((resolve, reject) => {
    if (res.access_token && res.expires_in && res.token_type && user.id) {
      if (doc) {
        // If we already have a connection card for this URL, update it
        try {
          const nowInSeconds = Math.floor(Date.now() / 1000);
          doc
            .update({
              $set: {
                access_token: res.access_token,
                expires_at: nowInSeconds + res.expires_in,
                id_token: res.id_token,
                last_sync_was_error: false,
              },
            })
            .then(() => {
              console.log('Updated connection card');
              console.log(doc.toJSON());
              resolve(true);
            })
            .catch((e) => {
              console.error(e);
              reject(new Error('Error updating connection'));
            });
        } catch (e) {
          console.error(e);
          reject(new Error('Error updating connection'));
        }
      } else {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        // Otherwise, create a new connection card
        const dbentry: Omit<CreateVeradigmConnectionDocument, 'refresh_token'> =
          {
            id: uuid4(),
            user_id: user.id,
            source: 'veradigm',
            location: veradigmBaseUrl,
            access_token: res.access_token,
            expires_at: nowInSeconds + res.expires_in,
            id_token: res.id_token,
            name,
            auth_uri,
            token_uri,
          };
        try {
          db.connection_documents.insert(dbentry).then(() => {
            resolve(true);
          });
        } catch (e) {
          console.error(e);
          reject(new Error('Error updating connection'));
        }
      }
    } else {
      reject(
        new Error('Error completing authentication: no access token provided')
      );
    }
  });
}

const VeradigmRedirect: React.FC = () => {
  const navigate = useNavigate(),
    user = useUser(),
    db = useRxDb(),
    notifyDispatch = useNotificationDispatch(),
    [error, setError] = useState(''),
    hasRun = useRef(false);

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      const searchRequest = new URLSearchParams(window.location.search),
        code = searchRequest.get('code'),
        errorMsg = searchRequest.get('error'),
        errorMsgDescription = searchRequest.get('error_description'),
        veradigmUrl = localStorage.getItem(
          VeradigmLocalStorageKeys.VERADIGM_BASE_URL
        ),
        veradigmName = localStorage.getItem(
          VeradigmLocalStorageKeys.VERADIGM_NAME
        ),
        veradigmAuthUrl = localStorage.getItem(
          VeradigmLocalStorageKeys.VERADIGM_AUTH_URL
        ),
        veradigmTokenUrl = localStorage.getItem(
          VeradigmLocalStorageKeys.VERADIGM_TOKEN_URL
        );
      // TODO: use tenant specific urls in connection document

      if (
        code &&
        veradigmTokenUrl &&
        veradigmAuthUrl &&
        veradigmUrl &&
        veradigmName
      ) {
        getConnectionCardByUrl<VeradigmConnectionDocument>(
          veradigmUrl,
          db
        ).then((doc) => {
          fetchAccessTokenWithCode(code, removeEndSlash(veradigmTokenUrl))
            .then((res) => {
              if (
                res.access_token &&
                res.expires_in &&
                res.token_type &&
                user.id
              ) {
                if (doc) {
                  // If we already have a connection card for this URL, update it
                  try {
                    const nowInSeconds = Math.floor(Date.now() / 1000);
                    doc
                      .update({
                        $set: {
                          access_token: res.access_token,
                          expires_at: nowInSeconds + res.expires_in,
                          id_token: res.id_token,
                          last_sync_was_error: false,
                        },
                      })
                      .then(() => {
                        navigate(Routes.AddConnection);
                      })
                      .catch((e) => {
                        console.error(e);
                        notifyDispatch({
                          type: 'set_notification',
                          message: `Error adding connection: ${
                            (e as Error).message
                          }`,
                          variant: 'error',
                        });
                        navigate(Routes.AddConnection);
                      });
                  } catch (e) {
                    console.error(e);
                    notifyDispatch({
                      type: 'set_notification',
                      message: `Error adding connection: ${
                        (e as Error).message
                      }`,
                      variant: 'error',
                    });
                    navigate(Routes.AddConnection);
                  }
                } else {
                  // Otherwise, create a new connection card
                  const nowInSeconds = Math.floor(Date.now() / 1000);
                  const dbentry: Omit<
                    CreateVeradigmConnectionDocument,
                    'patient'
                  > = {
                    id: uuid4(),
                    user_id: user.id,
                    source: 'veradigm',
                    location: veradigmUrl,
                    name: veradigmName,
                    access_token: res.access_token,
                    expires_at: nowInSeconds + res.expires_in,
                    id_token: res.id_token,
                    auth_uri: veradigmAuthUrl,
                    token_uri: veradigmTokenUrl,
                  };
                  db.connection_documents
                    .insert(dbentry)
                    .then(() => {
                      navigate(Routes.AddConnection);
                    })
                    .catch((e: unknown) => {
                      notifyDispatch({
                        type: 'set_notification',
                        message: `Error adding connection: ${
                          (e as Error).message
                        }`,
                        variant: 'error',
                      });
                      navigate(Routes.AddConnection);
                    });
                }
              } else {
                notifyDispatch({
                  type: 'set_notification',
                  message: `Error completing authentication: no access token provided`,
                  variant: 'error',
                });
              }
            })
            .catch((e) => {
              setError(`${(e as Error).message}`);
              notifyDispatch({
                type: 'set_notification',
                message: `Error adding connection: ${(e as Error).message}`,
                variant: 'error',
              });
              navigate(Routes.AddConnection);
            });
        });
      } else {
        if (
          !(
            code &&
            veradigmTokenUrl &&
            veradigmAuthUrl &&
            veradigmUrl &&
            veradigmName
          )
        ) {
          if (errorMsg && errorMsgDescription) {
            setError(`${errorMsg}: ${errorMsgDescription}`);
          } else {
            setError('There was a problem trying to sign in');
          }
        }

        // Otherwise, we're just pulling data
      }
    }
  }, [db.connection_documents, navigate, notifyDispatch, user.id]);

  return (
    <AppPage
      banner={
        <GenericBanner
          text={
            !error
              ? 'Authenticated! Redirecting'
              : 'There was a problem trying to sign in'
          }
        />
      }
    >
      {error && (
        <div className="flex h-full flex-col items-center justify-center">
          <h1 className="font-2xl mb-4 font-bold text-red-700">{error}</h1>
          <h1 className="font-xl mb-4 p-8 text-gray-600">
            You can try enabling proxy authentication in the settings section if
            login continues to fail
          </h1>
          <div className="flex flex-row justify-center gap-x-4">
            <button
              className="border-primary-700 text-primary w-36 rounded-lg border-2 bg-white p-4"
              onClick={() => navigate(`${Routes.Settings}#use_proxy`)}
            >
              Go to Settings
            </button>
            <button
              className="bg-primary w-36 rounded-lg p-4 text-white"
              onClick={() => navigate(Routes.AddConnection)}
            >
              Go Back
            </button>
          </div>
        </div>
      )}
      {!error && (
        <div className="flex-column flex h-full w-full items-center justify-center">
          <svg
            aria-hidden="true"
            className="fill-primary-700 mr-2 h-64 w-64 animate-spin text-gray-200 dark:text-gray-600"
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
        </div>
      )}
    </AppPage>
  );
};

export default VeradigmRedirect;
