import { IonContent, IonHeader, IonPage, IonTitle } from '@ionic/react';
import { useEffect } from 'react';
import { useHistory } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { CreateConnectionDocument } from '../models/ConnectionDocument';
import { useRxDb } from '../components/RxDbProvider';
import { Routes } from '../Routes';
import { environment } from '../environments/environment';

export interface OnPatientAuthResponse {
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

const OnPatientRedirect: React.FC = () => {
  const history = useHistory(),
    db = useRxDb();

  useEffect(() => {
    const searchRequest = new URLSearchParams(window.location.search),
      code = searchRequest.get('code');

    if (code) {
      if (process.env['NODE_ENV'] === 'development') {
        console.warn('This can double render in development');
      }

      const params = {
          grant_type: 'authorization_code',
          client_id: environment.onpatient_client_id,
          client_secret: environment.onpatient_client_secret,
          redirect_uri: environment.redirect_uri,
          code,
        },
        encodedParams = new URLSearchParams(params as Record<string, string>),
        url = `https://onpatient.com/o/token/?${encodedParams}`;
      // Even though this is a POST - Dr. Chrono expects the params as url encoded query params like a GET request. Don't ask me why.
      fetch(url, {
        method: 'POST',
      })
        .then((res) => res.json())
        .then((codeRes: OnPatientAuthResponse) => {
          const dbentry: CreateConnectionDocument = {
            _id: uuidv4(),
            source: 'onpatient',
            location: 'https://onpatient.com',
            ...codeRes,
          };
          console.log(dbentry);
          db.connection_documents
            .insert(dbentry)
            .then(() => {
              console.log('Saved!');
              history.push(Routes.AddConnection);
            })
            .catch((e: any) => {
              alert('Error adding connection');
              console.error(e);
              history.push(Routes.AddConnection);
            });
        })
        .catch((err) => {
          alert(`OAuth rejected: ${err}`);
          console.log(err);
        });
    }
  }, [db.connection_documents, history]);

  return (
    <IonPage>
      <IonHeader>
        <IonTitle>Authenticated! Redirecting</IonTitle>
      </IonHeader>
      <IonContent fullscreen></IonContent>
    </IonPage>
  );
};

export default OnPatientRedirect;
