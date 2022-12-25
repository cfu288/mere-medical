/* eslint-disable @typescript-eslint/no-namespace */
import {
  BundleEntry,
  Procedure,
  Immunization,
  Condition,
  DiagnosticReport,
  Observation,
  MedicationStatement,
  Patient,
  AllergyIntolerance,
  Practitioner,
  DocumentReference,
  CarePlan,
} from 'fhir/r2';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { v4 as uuidv4 } from 'uuid';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { UserDocument } from '../models/UserDocument';

function parseId<T>(bundleItem: BundleEntry<T>) {
  // OnPatient returns an array instead of a string, not to spec
  const isArrayId =
    Array.isArray(bundleItem.fullUrl as string | string[]) &&
    bundleItem.fullUrl &&
    bundleItem.fullUrl?.length > 0;
  // Hacky workaround for consistent ID's in OnPatient
  return isArrayId
    ? bundleItem.fullUrl?.[0].replace('/api/fhir/', '')
    : bundleItem.fullUrl;
}

export namespace DSTU2 {
  export function mapProcedureToClinicalDocument(
    bundleItem: BundleEntry<Procedure>,
    connectionDocument: ConnectionDocument
  ): ClinicalDocument<Procedure> {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'procedure',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: bundleItem.resource?.performedDateTime,
        display_name: bundleItem.resource?.code.text,
      },
    };
    return cd;
  }

  export function mapMedicationStatementToClinicalDocument(
    bundleItem: BundleEntry<MedicationStatement>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'medicationstatement',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date:
          bundleItem.resource?.dateAsserted ||
          bundleItem.resource?.effectivePeriod?.start,
        display_name: bundleItem.resource?.medicationCodeableConcept?.text,
      },
    };
    return cd;
  }

  export function mapObservationToClinicalDocument(
    bundleItem: BundleEntry<Observation>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'observation',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: bundleItem.resource?.effectiveDateTime,
        display_name: bundleItem.resource?.code.text,
      },
    };
    return cd;
  }

  export function mapDiagnosticReportToClinicalDocument(
    bundleItem: BundleEntry<DiagnosticReport>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'diagnosticreport',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: bundleItem.resource?.effectiveDateTime,
        display_name: bundleItem.resource?.code.text,
      },
    };
    return cd;
  }

  export function mapPatientToUserDocument(bundleItem: BundleEntry<Patient>) {
    const userDoc: UserDocument = {
      _id: uuidv4(),
      gender: bundleItem.resource?.gender,
      birthday: bundleItem.resource?.birthDate,
      first_name: bundleItem.resource?.name?.[0].given?.[0],
      last_name: bundleItem.resource?.name?.[0].family?.[0],
    };
    return userDoc;
  }

  export function mapPatientToClinicalDocument(
    bundleItem: BundleEntry<Patient>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'patient',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: new Date().toISOString(),
      },
    };
    return cd;
  }

  export function mapImmunizationToClinicalDocument(
    bundleItem: BundleEntry<Immunization>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'immunization',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: bundleItem.resource?.date,
        display_name: bundleItem.resource?.vaccineCode.text,
      },
    };
    return cd;
  }

  export function mapConditionToClinicalDocument(
    bundleItem: BundleEntry<Condition>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'condition',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: bundleItem.resource?.dateRecorded,
        display_name: bundleItem.resource?.code.text,
      },
    };
    return cd;
  }

  export function mapAllergyIntoleranceToClinicalDocument(
    bundleItem: BundleEntry<AllergyIntolerance>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'allergyintolerance',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),

        date: bundleItem.resource?.recordedDate,
        display_name: bundleItem.resource?.text?.div,
      },
    };
    return cd;
  }

  export function mapPractitionerToClinicalDocument(
    bundleItem: BundleEntry<Practitioner>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'practitioner',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: bundleItem.resource?.birthDate,
        display_name: bundleItem.resource?.text?.div,
      },
    };
    return cd;
  }

  export function mapDocumentReferenceToClinicalDocument(
    bundleItem: BundleEntry<DocumentReference>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'documentreference',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date:
          bundleItem.resource?.created ||
          bundleItem.resource?.context?.period?.start,
        display_name: bundleItem.resource?.type?.text,
      },
    };
    return cd;
  }

  export function mapCarePlanToClinicalDocument(
    bundleItem: BundleEntry<CarePlan>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: ClinicalDocument = {
      _id: uuidv4(),
      source_record: connectionDocument._id,
      data_record: {
        raw: bundleItem,
        format: 'FHIR.DSTU2',
        content_type: 'application/json',
        resource_type: 'careplan',
        version_history: [],
      },
      metadata: {
        id: parseId(bundleItem),
        date: bundleItem.resource?.period?.start,
        display_name: bundleItem.resource?.description,
      },
    };
    return cd;
  }
}
