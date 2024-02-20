import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import uuid4 from '../utils/UUIDUtils';
import {
  ConnectionDocument,
  CreateOnPatientConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';
import { useRxDb } from '../components/providers/RxDbProvider';
import { Routes } from '../Routes';
import { useNotificationDispatch } from '../components/providers/NotificationProvider';
import { AppPage } from '../components/AppPage';
import { GenericBanner } from '../components/GenericBanner';
import { useUser } from '../components/providers/UserProvider';
import { getConnectionCardByUrl } from '../services/getConnectionCardByUrl';

export interface OnPatientAuthResponse {
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

const OnPatientRedirect: React.FC = () => {
  const navigate = useNavigate(),
    user = useUser(),
    db = useRxDb(),
    notifyDispatch = useNotificationDispatch(),
    hasRun = useRef(false),
    { search } = useLocation();

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      const searchRequest = new URLSearchParams(search),
        accessToken = searchRequest.get('accessToken'),
        refreshToken = searchRequest.get('refreshToken'),
        expiresIn = searchRequest.get('expiresIn');

      if (accessToken && refreshToken && expiresIn && user.id) {
        getConnectionCardByUrl<ConnectionDocument>(
          'https://onpatient.com',
          db,
        ).then((doc) => {
          if (doc) {
            try {
              const nowInSeconds = Math.floor(Date.now() / 1000);
              doc
                .update({
                  $set: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_at: nowInSeconds + parseInt(expiresIn),
                    last_sync_was_error: false,
                  },
                })
                .then(() => {
                  navigate(Routes.AddConnection);
                })
                .catch((e: unknown) => {
                  console.error(e);
                  notifyDispatch({
                    type: 'set_notification',
                    message: `Error updating connection: ${
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
                message: `Error updating connection: ${(e as Error).message}`,
                variant: 'error',
              });
              navigate(Routes.AddConnection);
            }
          } else {
            const nowInSeconds = Math.floor(Date.now() / 1000);
            const dbentry: Omit<
              CreateOnPatientConnectionDocument,
              'patient' | 'scope'
            > = {
              id: uuid4(),
              user_id: user.id,
              source: 'onpatient',
              location: 'https://onpatient.com',
              name: 'OnPatient',
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: nowInSeconds + parseInt(expiresIn),
            };
            db.connection_documents
              .insert(dbentry)
              .then(() => {
                navigate(Routes.AddConnection);
              })
              .catch((e: unknown) => {
                notifyDispatch({
                  type: 'set_notification',
                  message: `Error adding connection: ${(e as Error).message}`,
                  variant: 'error',
                });
                navigate(Routes.AddConnection);
              });
          }
        });
      } else {
        notifyDispatch({
          type: 'set_notification',
          message: `Error completing authentication: no access token provided`,
          variant: 'error',
        });
      }
    }
  }, [db.connection_documents, navigate, notifyDispatch, user.id]);

  return (
    <AppPage banner={<GenericBanner text="Authenticated! Redirecting" />}>
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
    </AppPage>
  );
};

export default OnPatientRedirect;
