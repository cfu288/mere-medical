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
import { useEffect, useReducer, useState } from 'react';
import { MedicationsListCard } from '../components/summary/MedicationsListCard';
import { SkeletonListCard } from '../components/summary/SkeletonListCard';
import { ConditionsListCard } from '../components/summary/ConditionsListCard';
import { ImmunizationListCard } from '../components/summary/ImmunizationListCard';
import { CarePlanListCard } from '../components/summary/CarePlanListCard';
import { AllergyIntoleranceListCard } from '../components/summary/AllergyIntoleranceListCard';
import { EmptyRecordsPlaceholder } from '../components/EmptyRecordsPlaceholder';
import { AppPage } from '../components/AppPage';
import { useUser } from '../components/providers/UserProvider';
import { BookmarkedListCard } from '../components/summary/BookmarkedListCard';
import React from 'react';
import { MereRecommendationsListCard } from '../features/mere-ai-recommendations/components/MereRecommendationsListCard';
import { SummaryPagePreferences } from '../models/summary-page-preferences/SummaryPagePreferences.type';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { Modal } from '../components/Modal';
import { ModalHeader } from '../components/ModalHeader';

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

async function fetchSummaryPagePreferences(
  db: RxDatabase<DatabaseCollections>,
  user_id: string,
) {
  return db.summary_page_preferences
    .findOne({
      selector: {
        user_id: user_id,
      },
    })
    .exec();
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
  cards: SummaryPagePreferences['cards']; // Use only the cards property
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
        cards: SummaryPagePreferences['cards']; // Use only the cards property
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
        ...state,
        meds: action.data.meds,
        imm: action.data.imm,
        cond: action.data.cond,
        careplan: action.data.careplan,
        allergy: action.data.allergy,
        pinned: action.data.pinned,
        cards: action.data.cards, // Use only the cards property
        status: ActionTypes.COMPLETED,
        initialized: true,
      };
    }
  }
}

const DEFAULT_CARD_ORDER: SummaryPagePreferences['cards'] = [
  {
    type: 'recommendations',
    order: 0,
    is_visible: true,
  },
  {
    type: 'pinned',
    order: 1,
    is_visible: true,
  },
  {
    type: 'medications',
    order: 2,
    is_visible: true,
  },
  {
    type: 'conditions',
    order: 3,
    is_visible: true,
  },
  {
    type: 'immunizations',
    order: 4,
    is_visible: true,
  },
  {
    type: 'careplans',
    order: 5,
    is_visible: true,
  },
  {
    type: 'allergies',
    order: 6,
    is_visible: true,
  },
];

// Hook to fetch data for summary page
function useSummaryData(): [SummaryState, React.Dispatch<SummaryActions>] {
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
    cards: [], // Initialize cards as an empty array
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
        fetchSummaryPagePreferences(db, user.id).then((preferences) => {
          return preferences && preferences.toMutableJSON().cards
            ? preferences?.toMutableJSON().cards
            : DEFAULT_CARD_ORDER;
        }),
      ])
        .then(([meds, cond, imm, careplan, allergy, pinned, cards]) => {
          reducer({
            type: ActionTypes.COMPLETED,
            data: {
              meds,
              cond,
              imm,
              careplan,
              allergy,
              pinned,
              cards,
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
  const [{ meds, cond, imm, careplan, allergy, pinned, cards, initialized }] =
    useSummaryData();
  const [showEditModal, setShowEditModal] = useState(false);

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
    pinned.length === 0 &&
    (!cards || cards.length === 0) // Check if cards is not null or empty
  ) {
    return (
      <AppPage banner={<GenericBanner text="Summary" />}>
        <EmptyRecordsPlaceholder />
      </AppPage>
    );
  }

  return (
    <AppPage banner={<GenericBanner text="Summary" />}>
      <div className="mx-auto flex lg:max-w-7xl flex-col gap-x-4 px-4 pb-20 pt-2 lg:px-8 sm:grid sm:grid-cols-6 sm:pb-6">
        <MereRecommendationsListCard />
        <BookmarkedListCard items={pinned} />
        <MedicationsListCard items={meds} />
        <ConditionsListCard items={cond} />
        <ImmunizationListCard items={imm} />
        <CarePlanListCard items={careplan} />
        <AllergyIntoleranceListCard items={allergy} />
        {/* Floating FAB edit button */}
        <div className="fixed sm:bottom-4 bottom-20 right-4">
          <button
            className="flex transition bg-primary-700 hover:bg-primary-600 hover:scale-105 active:scale-95 text-white font-bold py-2 px-4 rounded-full align-baseline justify-center items-center"
            onClick={() => {
              setShowEditModal(true);
            }}
          >
            <p className="hidden md:block">Edit Layout</p>
            <p className="md:hidden">Edit</p>
            <PencilSquareIcon className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
      <Modal open={showEditModal} setOpen={setShowEditModal}>
        <ModalHeader
          title={'Summary Page Layout Settings'}
          setClose={() => setShowEditModal((x) => !x)}
        />
        <div className="p-4">
          <p className="text-lg font-bold mb-2">Coming Soon</p>
          <p>
            This feature is currently under development and will be available
            soon.
          </p>
        </div>
      </Modal>
    </AppPage>
  );
}

export default SummaryTab;
