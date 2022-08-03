import {
  BundleEntry,
  Procedure,
  Immunization,
  Condition,
  DiagnosticReport,
  Observation,
} from "fhir/r2";
import { ConnectionDocument } from "../models/ConnectionDocument";
import { CreateClinicalDocument } from "../models/CreateClinicalDocument";
import { v4 as uuidv4 } from "uuid";

export namespace DSTU2 {
  export function mapProcedureToCreateClinicalDocument(
    procedure: BundleEntry<Procedure>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: CreateClinicalDocument = {
      _id: uuidv4(),
      type: "clinical",
      version: 1,
      source_record: connectionDocument._id,
      data_record: {
        raw: procedure,
        format: "FHIR.DSTU2",
        content_type: "application/json",
        resource_type: "procedure",
        version_history: [],
      },
      metadata: {
        id: "procedure_" + procedure.resource?.id,
        date: procedure.resource?.performedDateTime,
        display_name: procedure.resource?.code.text,
        merge_key: `"procedure_"${procedure.resource?.performedDateTime}_${procedure.resource?.code.text}`,
      },
    };
    return cd;
  }

  export function mapObservationToCreateClinicalDocument(
    procedure: BundleEntry<Observation>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: CreateClinicalDocument = {
      _id: uuidv4(),
      type: "clinical",
      version: 1,
      source_record: connectionDocument._id,
      data_record: {
        raw: procedure,
        format: "FHIR.DSTU2",
        content_type: "application/json",
        resource_type: "observation",
        version_history: [],
      },
      metadata: {
        id: "observation_" + procedure.resource?.id,
        date: procedure.resource?.effectiveDateTime,
        display_name: procedure.resource?.code.text,
        merge_key: `"observation_"${procedure.resource?.effectiveDateTime}_${procedure.resource?.code.text}`,
      },
    };
    return cd;
  }

  export function mapDiagnosticReportToCreateClinicalDocument(
    procedure: BundleEntry<DiagnosticReport>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: CreateClinicalDocument<BundleEntry<DiagnosticReport>> = {
      _id: uuidv4(),
      type: "clinical",
      version: 1,
      source_record: connectionDocument._id,
      data_record: {
        raw: procedure,
        format: "FHIR.DSTU2",
        content_type: "application/json",
        resource_type: "diagnostic_report",
        version_history: [],
      },
      metadata: {
        id: "diagnostic_report_" + procedure.resource?.id,
        date: procedure.resource?.effectiveDateTime,
        display_name: procedure.resource?.code.text,
        merge_key: `"diagnostic_report_"${procedure.resource?.effectiveDateTime}_${procedure.resource?.code.text}`,
      },
    };
    return cd;
  }

  export function mapImmunizationToCreateClinicalDocument(
    procedure: BundleEntry<Immunization>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: CreateClinicalDocument<BundleEntry<Immunization>> = {
      _id: uuidv4(),
      type: "clinical",
      version: 1,
      source_record: connectionDocument._id,
      data_record: {
        raw: procedure,
        format: "FHIR.DSTU2",
        content_type: "application/json",
        resource_type: "immunization",
        version_history: [],
      },
      metadata: {
        id: "immunization_" + procedure.resource?.id,
        date: procedure.resource?.date,
        display_name: procedure.resource?.vaccineCode.text,
        merge_key: `"immunization_"${procedure.resource?.date}_${procedure.resource?.vaccineCode.text}`,
      },
    };
    return cd;
  }

  export function mapConditionToCreateClinicalDocument(
    procedure: BundleEntry<Condition>,
    connectionDocument: ConnectionDocument
  ) {
    const cd: CreateClinicalDocument<BundleEntry<Condition>> = {
      _id: uuidv4(),
      type: "clinical",
      version: 1,
      source_record: connectionDocument._id,
      data_record: {
        raw: procedure,
        format: "FHIR.DSTU2",
        content_type: "application/json",
        resource_type: "condition",
        version_history: [],
      },
      metadata: {
        id: "condition_" + procedure.resource?.id,
        date: procedure.resource?.dateRecorded,
        display_name: procedure.resource?.code.text,
        merge_key: `"condition_"${procedure.resource?.dateRecorded}_${procedure.resource?.code.text}`,
      },
    };
    return cd;
  }
}
