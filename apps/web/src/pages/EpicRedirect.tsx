import { IonContent, IonHeader, IonPage, IonTitle } from '@ionic/react';
import { useEffect } from 'react';
import { useHistory } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { CreateConnectionDocument } from '../models/ConnectionDocument';
import { useRxDb } from '../components/RxDbProvider';
import { Routes } from '../Routes';
import Config from '../environments/config.json';
import { Epic } from '../services/Epic';

export interface EpicAuthResponse {
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

const EpicRedirect: React.FC = () => {
  const history = useHistory(),
    db = useRxDb();

  useEffect(() => {
    const searchRequest = new URLSearchParams(window.location.search),
      code = searchRequest.get('code');

    if (code) {
      fetch(`${Epic.EpicBaseUrl}oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: `${Config.EPIC_CLIENT_ID}`,
          redirect_uri: `${Config.PUBLIC_URL}${Routes.EpicCallback}`,
          code: code,
        }),
      })
        .then((response) => response.json())
        .then(
          (res: {
            access_token: string;
            token_type: string;
            expires_in: number;
            scope: string;
            patient: string;
            '__epic.dstu2.patient': string;
          }) => {
            if (res.access_token && res.expires_in && res.patient) {
              const dbentry: Omit<CreateConnectionDocument, 'refresh_token'> = {
                _id: uuidv4(),
                source: 'epic',
                location: Epic.EpicBaseUrl,
                access_token: res.access_token,
                expires_in: res.expires_in,
                scope: res.scope,
                patient: res.patient,
              };
              db.connection_documents
                .insert(dbentry)
                .then(() => {
                  history.push(Routes.AddConnection);
                })
                .catch((e: any) => {
                  alert('Error adding connection');
                  console.error(e);
                  history.push(Routes.AddConnection);
                });
            } else {
              alert(
                'Error completing authentication: no access token provided'
              );
            }
          }
        );
    }
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonTitle>Authenticated! Redirecting</IonTitle>
      </IonHeader>
      <IonContent fullscreen></IonContent>
    </IonPage>
  );
};

export default EpicRedirect;
