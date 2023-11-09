/**
 * Functions related to authenticating against the OnPatient patient portal and syncing data
 */

import {
  Bundle,
  BundleEntry,
  Procedure,
  Immunization,
  Condition,
  Observation,
  DiagnosticReport,
  MedicationStatement,
  Patient,
  FhirResource,
} from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/RxDbProvider';
import { DSTU2 } from '.';
import Config from '../environments/config.json';
import { ConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';

export const OnPatientBaseUrl = 'https://onpatient.com';
export const OnPatientDSTU2Url = `${OnPatientBaseUrl}/api/fhir`;

export function getLoginUrl(): string & Location {
  return `${OnPatientBaseUrl}/o/authorize/?${new URLSearchParams({
    client_id: Config.ONPATIENT_CLIENT_ID,
    redirect_uri: `${Config.PUBLIC_URL}/api/v1/onpatient/callback`,
    scope: 'patient/*.read',
    response_type: 'code',
  })}` as string & Location;
}

async function getFHIRResource<T extends FhirResource>(
  connectionDocument: ConnectionDocument,
  fhirResourcePathUrl: string
): Promise<BundleEntry<T>[]> {
  const res = await fetch(`${OnPatientDSTU2Url}/${fhirResourcePathUrl}`, {
    headers: {
      Authorization: `Bearer ${connectionDocument.access_token}`,
    },
  })
    .then((res) => res.json())
    .then((res: Bundle) => res);

  if (res.entry) {
    return res.entry as BundleEntry<T>[];
  }
  return [];
}

async function syncFHIRResource<T extends FhirResource>(
  connectionDocument: ConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => ClinicalDocument<BundleEntry<T>>
) {
  const fhirResources = await getFHIRResource<T>(
    connectionDocument,
    fhirResourceUrl
  );
  const cds = fhirResources
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() === fhirResourceUrl.toLowerCase()
    )
    .map(mapper);
  const cdsmap = await db.clinical_documents.bulkUpsert(
    cds as unknown as ClinicalDocument[]
  );
  return cdsmap;
}

export async function syncAllRecords(
  connectionDocument: ConnectionDocument,
  db: RxDatabase<DatabaseCollections>
): Promise<PromiseSettledResult<void[]>[]> {
  const immMapper = (dr: BundleEntry<Immunization>) =>
    DSTU2.mapImmunizationToClinicalDocument(dr, connectionDocument);
  const procMapper = (proc: BundleEntry<Procedure>) =>
    DSTU2.mapProcedureToClinicalDocument(proc, connectionDocument);
  const patientMapper = (pt: BundleEntry<Patient>) =>
    DSTU2.mapPatientToClinicalDocument(pt, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    DSTU2.mapObservationToClinicalDocument(imm, connectionDocument);
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    DSTU2.mapDiagnosticReportToClinicalDocument(dr, connectionDocument);
  const medStatementMapper = (dr: BundleEntry<MedicationStatement>) =>
    DSTU2.mapMedicationStatementToClinicalDocument(dr, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    DSTU2.mapConditionToClinicalDocument(dr, connectionDocument);

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Immunization>(
      connectionDocument,
      db,
      'Immunization',
      immMapper
    ),
    syncFHIRResource<Procedure>(
      connectionDocument,
      db,
      'Procedure',
      procMapper
    ),
    syncFHIRResource<Condition>(
      connectionDocument,
      db,
      'Condition',
      conditionMapper
    ),
    syncFHIRResource<Observation>(
      connectionDocument,
      db,
      'Observation',
      obsMapper
    ),
    syncFHIRResource<DiagnosticReport>(
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper
    ),
    syncFHIRResource<MedicationStatement>(
      connectionDocument,
      db,
      'MedicationStatement',
      medStatementMapper
    ),
    syncFHIRResource<Patient>(connectionDocument, db, 'Patient', patientMapper),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}
