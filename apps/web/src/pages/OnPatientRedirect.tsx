import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect } from 'react';
import { useHistory } from 'react-router';
import ExploreContainer from '../components/ExploreContainer';
import { v4 as uuidv4 } from 'uuid';
import { CreateConnectionDocument } from '../models/ConnectionDocument';
import { usePouchDb } from '../components/PouchDbProvider';
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
    db = usePouchDb();

  useEffect(() => {
    const searchRequest = new URLSearchParams(window.location.search),
      code = searchRequest.get('code'),
      params = {
        grant_type: 'authorization_code',
        client_id: environment.onpatient_client_id,
        client_secret: environment.onpatient_client_secret,
        redirect_uri: environment.redirect_uri,
        code,
      };

    if (code) {
      const encodedParams = new URLSearchParams(
        params as Record<string, string>
      );
      const url = `https://onpatient.com/o/token/?${encodedParams}`;
      // Even though this is a POST - Dr. Chrono expects the params as url encoded query params like a GET request. Don't ask me why.
      fetch(url, {
        method: 'POST',
      })
        .then((res) => res.json())
        .then((codeRes: OnPatientAuthResponse) => {
          const dbentry: CreateConnectionDocument = {
            _id: uuidv4(),
            type: 'connection',
            version: 1,
            source: 'onpatient',
            location: 'https://onpatient.com',
            ...codeRes,
          };
          db.put(dbentry)
            .then(() => console.log('Saved!'))
            .catch((e: any) => {
              alert('err');
              console.error(e);
            });
          // redirect
          history.push(Routes.AddConnection);
        })
        .catch((err) => {
          alert('OAuth rejected');
          console.log(err);
        });
    }
  }, [history, db]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Authenticated! Redirecting</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Authenticated!</IonTitle>
          </IonToolbar>
        </IonHeader>
        <ExploreContainer name="One second..." />
      </IonContent>
    </IonPage>
  );
};

export default OnPatientRedirect;
