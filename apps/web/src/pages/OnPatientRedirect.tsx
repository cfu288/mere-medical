import { IonContent, IonHeader, IonPage, IonTitle } from '@ionic/react';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { CreateConnectionDocument } from '../models/ConnectionDocument';
import { useRxDb } from '../components/RxDbProvider';
import { Routes } from '../Routes';

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
    db = useRxDb(),
    [count, setCount] = useState(0);

  useEffect(() => {
    if (count === 0) {
      setCount((count) => count + 1);
      const searchRequest = new URLSearchParams(window.location.search),
        accessToken = searchRequest.get('accessToken'),
        refreshToken = searchRequest.get('refreshToken'),
        expiresIn = searchRequest.get('expiresIn');

      if (accessToken && refreshToken && expiresIn) {
        const dbentry: Omit<CreateConnectionDocument, 'patient' | 'scope'> = {
          _id: uuidv4(),
          source: 'onpatient',
          location: 'https://onpatient.com',
          name: 'OnPatient',
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: parseInt(expiresIn),
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
        alert('Error completing authentication: no access token provided');
      }
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
