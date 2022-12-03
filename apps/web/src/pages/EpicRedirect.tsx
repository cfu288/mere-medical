import { IonContent, IonHeader, IonPage, IonTitle } from '@ionic/react';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { CreateConnectionDocument } from '../models/ConnectionDocument';
import { useRxDb } from '../components/RxDbProvider';
import { Routes } from '../Routes';
import FHIR from 'fhirclient';
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
    db = useRxDb(),
    [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (window as any).FHIR = FHIR;

    FHIR.oauth2
      .ready()
      .then(() => {
        setIsReady(true);
      })
      .catch(() => console.error('not ready'));
  }, []);

  useEffect(() => {
    if (isReady) {
      alert('ready!');
      FHIR.oauth2
        .ready()
        .then((client) => client.request('Patient'))
        .then(console.log)
        .catch(console.error);
    }
  }, [isReady]);

  return (
    <IonPage>
      <IonHeader>
        <IonTitle>Authenticated! Redirecting</IonTitle>
      </IonHeader>
      <IonContent fullscreen>hello</IonContent>
    </IonPage>
  );
};

export default EpicRedirect;
