import { IonContent, IonHeader, IonPage } from '@ionic/react';
import { DatabaseCollections, useRxDb } from '../components/RxDbProvider';
import { GenericBanner } from '../components/GenericBanner';
import { ClinicalDocument } from '../models/ClinicalDocument';
import {
  AllergyIntolerance,
  BundleEntry,
  CarePlan,
  Condition,
  FhirResource,
  Immunization,
  MedicationStatement,
} from 'fhir/r2';
import { RxDatabase, RxDocument } from 'rxdb';
import { useEffect, useReducer } from 'react';
import { MedicationsListCard } from '../components/Summary/MedicationsListCard';
import { ConditionsListCard } from '../components/Summary/ConditionsListCard';
import { ImmunizationListCard } from '../components/Summary/ImmunizationListCard';
import { CarePlanListCard } from '../components/Summary/CarePlanListCard';
import { AllerrgyIntoleranceListCard } from '../components/Summary/AllerrgyIntoleranceListCard';
import { EmptyRecordsPlaceholder } from '../models/EmptyRecordsPlaceholder';

function fetchMedications(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': 'medicationstatement',
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

function fetchCarePlan(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': 'careplan',
      },
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
function fetchAllergy(db: RxDatabase<DatabaseCollections>) {
  return db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': 'allergyintolerance',
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
  careplan: ClinicalDocument<BundleEntry<CarePlan>>[];
  allergy: ClinicalDocument<BundleEntry<AllergyIntolerance>>[];
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
        careplan: ClinicalDocument<BundleEntry<CarePlan>>[];
        allergy: ClinicalDocument<BundleEntry<AllergyIntolerance>>[];
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
        careplan: action.data.careplan,
        allergy: action.data.allergy,
        status: ActionTypes.COMPLETED,
      };
    }
  }
}

const SummaryTab: React.FC = () => {
  const db = useRxDb(),
    [{ status, meds, cond, imm, careplan, allergy }, reducer] = useReducer(
      summaryReducer,
      {
        status: ActionTypes.IDLE,
        meds: [],
        cond: [],
        imm: [],
        careplan: [],
        allergy: [],
      }
    );

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
        fetchCarePlan(db).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<BundleEntry<CarePlan>>
          )
        ),
        fetchAllergy(db).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<AllergyIntolerance>
              >
          )
        ),
      ])
        .then(([meds, cond, imm, careplan, allergy]) => {
          reducer({
            type: ActionTypes.COMPLETED,
            data: {
              meds,
              cond,
              imm,
              careplan,
              allergy,
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
        <div className="mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pt-2 pb-4 sm:px-6 lg:px-8">
          {meds.length === 0 &&
            cond.length === 0 &&
            imm.length === 0 &&
            careplan.length === 0 &&
            allergy.length === 0 && <EmptyRecordsPlaceholder />}
          <MedicationsListCard items={meds} />
          <ConditionsListCard items={cond} />
          <ImmunizationListCard items={imm} />
          <CarePlanListCard items={careplan} />
          <AllerrgyIntoleranceListCard items={allergy} />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SummaryTab;
