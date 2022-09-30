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
import { useEffect, useReducer } from 'react';
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

enum ActionTypes {
  IDLE,
  PENDING,
  COMPLETED,
  ERROR,
}

type SummaryState = {
  status: ActionTypes;
  meds: ClinicalDocument<BundleEntry<MedicationStatement>>[];
  cond: ClinicalDocument<BundleEntry<Condition>>[];
  imm: ClinicalDocument<BundleEntry<Immunization>>[];
};

type SummaryActions =
  | { type: ActionTypes.IDLE }
  | { type: ActionTypes.PENDING }
  | { type: ActionTypes.ERROR }
  | {
      type: ActionTypes.COMPLETED;
      data: {
        meds: ClinicalDocument<BundleEntry<MedicationStatement>>[];
        cond: ClinicalDocument<BundleEntry<Condition>>[];
        imm: ClinicalDocument<BundleEntry<Immunization>>[];
      };
    };

function summaryReducer(state: SummaryState, action: SummaryActions) {
  switch (action.type) {
    case ActionTypes.IDLE: {
      return {
        ...state,
        status: ActionTypes.IDLE,
      };
    }
    case ActionTypes.PENDING: {
      return {
        ...state,
        status: ActionTypes.PENDING,
      };
    }
    case ActionTypes.ERROR: {
      return {
        ...state,
        status: ActionTypes.ERROR,
      };
    }
    case ActionTypes.COMPLETED: {
      return {
        meds: action.data.meds,
        imm: action.data.imm,
        cond: action.data.cond,
        status: ActionTypes.COMPLETED,
      };
    }
  }
}

const SummaryTab: React.FC = () => {
  const db = useRxDb(),
    [{ status, meds, cond, imm }, reducer] = useReducer(summaryReducer, {
      status: ActionTypes.IDLE,
      meds: [],
      cond: [],
      imm: [],
    });

  useEffect(() => {
    if (status === ActionTypes.IDLE) {
      reducer({ type: ActionTypes.PENDING });
      Promise.all([
        fetchMedications(db).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<MedicationStatement>
              >
          )
        ),
        fetchConditions(db).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<BundleEntry<Condition>>
          )
        ),
        fetchImmunizations(db).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<Immunization>
              >
          )
        ),
      ])
        .then(([meds, cond, imm]) => {
          reducer({
            type: ActionTypes.COMPLETED,
            data: {
              meds,
              cond,
              imm,
            },
          });
        })
        .catch((err) => {
          reducer({ type: ActionTypes.ERROR });
        });
    }
  }, [status, db]);

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
