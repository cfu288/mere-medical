import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import { GenericBanner } from '../components/GenericBanner';
import { useRxDb } from '../components/RxDbProvider';

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
