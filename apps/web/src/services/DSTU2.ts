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
} from 'fhir/r2';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { v4 as uuidv4 } from 'uuid';
import { ClinicalDocument } from '../models/ClinicalDocument';
import { UserDocument } from '../models/UserDocument';

export namespace DSTU2 {
  export function mapProcedureToCreateClinicalDocument(
    bundleItem: BundleEntry<Procedure>,
    connectionDocument: ConnectionDocument
  ) {
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
        id: 'procedure_' + bundleItem.resource?.id,
        date: bundleItem.resource?.performedDateTime,
        display_name: bundleItem.resource?.code.text,
        merge_key: `"procedure_"${bundleItem.resource?.performedDateTime}_${bundleItem.resource?.code.text}`,
      },
    };
    return cd;
  }

  export function mapMedicationStatementToCreateClinicalDocument(
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
        resource_type: 'medication_statement',
        version_history: [],
      },
      metadata: {
        id: 'medication_statement_' + bundleItem.resource?.id,
        date: bundleItem.resource?.dateAsserted,
        display_name: bundleItem.resource?.medicationCodeableConcept?.text,
        merge_key: `"medication_statement_"${bundleItem.resource?.dateAsserted}_${bundleItem.resource?.medicationCodeableConcept?.text}`,
      },
    };
    return cd;
  }

  export function mapObservationToCreateClinicalDocument(
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
        id: 'observation_' + bundleItem.resource?.id,
        date: bundleItem.resource?.effectiveDateTime,
        display_name: bundleItem.resource?.code.text,
        merge_key: `"observation_"${bundleItem.resource?.effectiveDateTime}_${bundleItem.resource?.code.text}`,
      },
    };
    return cd;
  }

  export function mapDiagnosticReportToCreateClinicalDocument(
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
        resource_type: 'diagnostic_report',
        version_history: [],
      },
      metadata: {
        id: 'diagnostic_report_' + bundleItem.resource?.id,
        date: bundleItem.resource?.effectiveDateTime,
        display_name: bundleItem.resource?.code.text,
        merge_key: `"diagnostic_report_"${bundleItem.resource?.effectiveDateTime}_${bundleItem.resource?.code.text}`,
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

  export function mapPatientToCreateClinicalDocument(
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
        id: 'patient_' + bundleItem.resource?.id,
        date: new Date().toISOString(),
      },
    };
    return cd;
  }

  export function mapImmunizationToCreateClinicalDocument(
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
        id: 'immunization_' + bundleItem.resource?.id,
        date: bundleItem.resource?.date,
        display_name: bundleItem.resource?.vaccineCode.text,
        merge_key: `"immunization_"${bundleItem.resource?.date}_${bundleItem.resource?.vaccineCode.text}`,
      },
    };
    return cd;
  }

  export function mapConditionToCreateClinicalDocument(
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
        id: 'condition_' + bundleItem.resource?.id,
        date: bundleItem.resource?.dateRecorded,
        display_name: bundleItem.resource?.code.text,
        merge_key: `"condition_"${bundleItem.resource?.dateRecorded}_${bundleItem.resource?.code.text}`,
      },
    };
    return cd;
  }
}
