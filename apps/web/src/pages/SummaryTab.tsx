import { useRxDb } from '../components/providers/RxDbProvider';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import { GenericBanner } from '../components/GenericBanner';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import {
  AllergyIntolerance,
  BundleEntry,
  CarePlan,
  Condition,
  DiagnosticReport,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
} from 'fhir/r2';
import { RxDatabase, RxDocument } from 'rxdb';
import { useEffect, useReducer } from 'react';
import { MedicationsListCard } from '../components/summary/MedicationsListCard';
import { SkeletonListCard } from '../components/summary/SkeletonListCard';
import { ConditionsListCard } from '../components/summary/ConditionsListCard';
import { ImmunizationListCard } from '../components/summary/ImmunizationListCard';
import { CarePlanListCard } from '../components/summary/CarePlanListCard';
import { AllergyIntoleranceListCard } from '../components/summary/AllergyIntoleranceListCard';
import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import { AppPage } from '../components/AppPage';
import { useUser } from '../components/providers/UserProvider';
import { PinnedListCard } from '../components/summary/PinnedListCard';
import React from 'react';
import { USPSTFRecommendationsListCard } from '../features/preventative-medicine-recommendations/components/USPSTFRecommendationsListCard';

function fetchMedications(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
) {
  return db.clinical_documents
    .find({
      selector: {
        user_id: user_id,
        'data_record.resource_type': 'medicationstatement',
        'metadata.date': { $nin: [null, undefined, ''] },
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

function fetchCarePlan(db: RxDatabase<DatabaseCollections>, user_id: string) {
  return db.clinical_documents
    .find({
      selector: {
        user_id: user_id,
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

function fetchConditions(db: RxDatabase<DatabaseCollections>, user_id: string) {
  return db.clinical_documents
    .find({
      selector: {
        user_id: user_id,
        'data_record.resource_type': 'condition',
        'metadata.date': { $nin: [null, undefined, ''] },
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

function fetchImmunizations(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
) {
  return db.clinical_documents
    .find({
      selector: {
        user_id: user_id,
        'data_record.resource_type': 'immunization',
        'metadata.date': { $nin: [null, undefined, ''] },
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

function fetchAllergy(db: RxDatabase<DatabaseCollections>, user_id: string) {
  return db.clinical_documents
    .find({
      selector: {
        user_id: user_id,
        'data_record.resource_type': 'allergyintolerance',
        'metadata.date': { $nin: [null, undefined, ''] },
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

async function fetchPinned(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
) {
  const pinnedIds = await db.summary_page_preferences
    .findOne({
      selector: {
        user_id: user_id,
      },
    })
    .exec();

  if (pinnedIds === null) {
    return [];
  }

  const pinnedIdsList = pinnedIds.pinned_labs || [];

  return db.clinical_documents.findByIds(pinnedIdsList).then((map) => {
    const lst = [...map.values()] as RxDocument<
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
  pinned: ClinicalDocument<BundleEntry<DiagnosticReport | Observation>>[];
  initialized: boolean;
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
        pinned: ClinicalDocument<BundleEntry<DiagnosticReport | Observation>>[];
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
        pinned: action.data.pinned,
        status: ActionTypes.COMPLETED,
        initialized: true,
      };
    }
  }
}

// Hook to fetch data for summary page
function useSummaryData(): [
  {
    status: ActionTypes;
    meds: ClinicalDocument<BundleEntry<MedicationStatement>>[];
    cond: ClinicalDocument<BundleEntry<Condition>>[];
    imm: ClinicalDocument<BundleEntry<Immunization>>[];
    careplan: ClinicalDocument<BundleEntry<CarePlan>>[];
    allergy: ClinicalDocument<BundleEntry<AllergyIntolerance>>[];
    pinned: ClinicalDocument<BundleEntry<DiagnosticReport | Observation>>[];
    initialized: boolean;
  },
  React.Dispatch<SummaryActions>,
] {
  const db = useRxDb(),
    user = useUser();
  const [data, reducer] = useReducer(summaryReducer, {
    status: ActionTypes.IDLE,
    meds: [],
    cond: [],
    imm: [],
    careplan: [],
    allergy: [],
    pinned: [],
    initialized: false,
  });

  useEffect(() => {
    if (data.status === ActionTypes.IDLE) {
      reducer({ type: ActionTypes.PENDING });
      Promise.all([
        fetchMedications(db, user.id).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<MedicationStatement>
              >,
          ),
        ),
        fetchConditions(db, user.id).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<BundleEntry<Condition>>,
          ),
        ),
        fetchImmunizations(db, user.id).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<Immunization>
              >,
          ),
        ),
        fetchCarePlan(db, user.id).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<BundleEntry<CarePlan>>,
          ),
        ),
        fetchAllergy(db, user.id).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<AllergyIntolerance>
              >,
          ),
        ),
        fetchPinned(db, user.id).then((data) =>
          data.map(
            (item) =>
              item.toMutableJSON() as ClinicalDocument<
                BundleEntry<DiagnosticReport | Observation>
              >,
          ),
        ),
      ])
        .then(([meds, cond, imm, careplan, allergy, pinned]) => {
          reducer({
            type: ActionTypes.COMPLETED,
            data: {
              meds,
              cond,
              imm,
              careplan,
              allergy,
              pinned,
            },
          });
        })
        .catch((err) => {
          reducer({ type: ActionTypes.ERROR });
        });
    }
  }, [data.status, db, user.id]);

  return [data, reducer];
}

function SummaryTab() {
  const [{ meds, cond, imm, careplan, allergy, pinned, initialized }] =
    useSummaryData();

  if (!initialized) {
    return (
      <AppPage banner={<GenericBanner text="Summary" />}>
        <div
          className={
            'mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pb-20 pt-2 lg:px-8' +
            'sm:mx-0 sm:grid sm:grid-cols-6 sm:pb-6'
          }
        >
          <div className="col-span-6 sm:col-span-3">
            <SkeletonListCard />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <SkeletonListCard />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <SkeletonListCard />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <SkeletonListCard />
          </div>
        </div>
      </AppPage>
    );
  }

  if (
    meds.length === 0 &&
    cond.length === 0 &&
    imm.length === 0 &&
    careplan.length === 0 &&
    allergy.length === 0 &&
    pinned.length === 0
  ) {
    return (
      <AppPage banner={<GenericBanner text="Summary" />}>
        <EmptyRecordsPlaceholder />
      </AppPage>
    );
  }

  return (
    <AppPage banner={<GenericBanner text="Summary" />}>
      <div
        className={
          'mx-auto flex max-w-4xl flex-col gap-x-4 px-4 pb-20 pt-2 lg:px-8' +
          'sm:mx-0 sm:grid sm:grid-cols-6 sm:pb-6'
        }
      >
        <USPSTFRecommendationsListCard />
        <PinnedListCard items={pinned} />
        <MedicationsListCard items={meds} />
        <ConditionsListCard items={cond} />
        <ImmunizationListCard items={imm} />
        <CarePlanListCard items={careplan} />
        <AllergyIntoleranceListCard items={allergy} />
      </div>
    </AppPage>
  );
}

export default SummaryTab;
