import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { OnPatient } from '../services/OnPatient';
import { useRxDb } from '../components/RxDbProvider';
import { ConnectionCard } from '../app/ConnectionCard';
import { isElectron } from '../utils/electron';
import { GenericBanner } from '../app/GenericBanner';

const SettingsTab: React.FC = () => {
  const db = useRxDb();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <GenericBanner text="Settings" />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="w-full box-border	flex justify-center align-middle">
          <p>TODO</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsTab;
