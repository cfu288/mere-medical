import { IonContent, IonHeader, IonPage } from '@ionic/react';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { GenericBanner } from '../components/GenericBanner';
import { ClinicalDocument } from '../models/ClinicalDocument';
import {
  BundleEntry,
  Condition,
  FhirResource,
  Immunization,
  MedicationStatement,
} from 'fhir/r2';
import { RxDatabase, RxDocument } from 'rxdb';
import { useEffect, useState } from 'react';
import { MedicationsListCard } from '../components/MedicationsListCard';
import { ConditionsListCard } from '../components/ConditionsListCard';
import { ImmunizationListCard } from '../components/ImmunizationListCard';

function fetchMedications(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': 'medication_statement',
        'metadata.date': { $gt: 0 },
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec()
    .then((list) => {
      const lst = list as unknown as RxDocument<
        ClinicalDocument<BundleEntry<FhirResource>>
      >[];

      return lst;
    });
}

function fetchConditions(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': 'condition',
        'metadata.date': { $gt: 0 },
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec()
    .then((list) => {
      const lst = list as unknown as RxDocument<
        ClinicalDocument<BundleEntry<FhirResource>>
      >[];

      return lst;
    });
}

function fetchImmunizations(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': 'immunization',
        'metadata.date': { $gt: 0 },
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec()
    .then((list) => {
      const lst = list as unknown as RxDocument<
        ClinicalDocument<BundleEntry<FhirResource>>
      >[];

      return lst;
    });
}

const SummaryTab: React.FC = () => {
  const db = useRxDb(),
    [meds, setMeds] = useState<
      ClinicalDocument<BundleEntry<MedicationStatement>>[]
    >([]),
    [cond, setCond] = useState<ClinicalDocument<BundleEntry<Condition>>[]>([]),
    [imm, setImm] = useState<ClinicalDocument<BundleEntry<Immunization>>[]>([]);

  useEffect(() => {
    fetchMedications(db).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      // @ts-ignore
      setMeds(res);
    });
    fetchConditions(db).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      // @ts-ignore
      setCond(res);
    });
    fetchImmunizations(db).then((data) => {
      const res = data.map((item) => item.toMutableJSON());
      // @ts-ignore
      setImm(res);
    });
  }, [db]);

  return (
    <IonPage>
      <IonHeader>
        <GenericBanner text="Summary" />
      </IonHeader>
      <IonContent fullscreen>
        <div className="flex flex-col max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 gap-x-4">
          <MedicationsListCard items={meds} />
          <ConditionsListCard items={cond} />
          <ImmunizationListCard items={imm} />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SummaryTab;
