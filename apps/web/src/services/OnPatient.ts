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
import { RxDatabase, RxDocument } from 'rxdb';
import { DatabaseCollections } from '../components/providers/RxDbProvider';
import { ClinicalDocumentType } from '../models/ClinicalDocumentCollection';
import { ConnectionDocument } from '../models/ConnectionDocument';
import { DSTU2 } from './DSTU2';
import Config from '../environments/config.json';
import { ClinicalDocument } from '../models/ClinicalDocument';

export const OnPatientBaseUrl = 'https://onpatient.com';
export const OnPatientDSTU2Url = `${OnPatientBaseUrl}/api/fhir`;

export function getLoginUrl() {
  return `${OnPatientBaseUrl}/o/authorize/?${new URLSearchParams({
    client_id: Config.ONPATIENT_CLIENT_ID,
    redirect_uri: `${Config.PUBLIC_URL}/api/v1/onpatient/callback`,
    scope: 'patient/*.read',
    response_type: 'code',
  })}`;
}

async function getFHIRResource<T extends FhirResource>(
  connectionDocument: RxDocument<ConnectionDocument>,
  fhirResourcePathUrl: string
): Promise<BundleEntry<T>[]> {
  const res = await fetch(`${OnPatientDSTU2Url}/${fhirResourcePathUrl}`, {
    headers: {
      Authorization: `Bearer ${connectionDocument.get('access_token')}`,
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
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => ClinicalDocument<BundleEntry<T>>
) {
  const fhirResources = await getFHIRResource<T>(
    connectionDocument,
    fhirResourceUrl
  );
  const clinDocs = fhirResources
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() === fhirResourceUrl.toLowerCase()
    )
    .map(mapper);
  const saveTaskList = clinDocs.map(async (doc) => {
    const exists = await db.clinical_documents
      .find({
        selector: {
          $and: [
            { 'metadata.id': `${doc.metadata?.id}` },
            { source_record: `${doc.source_record}` },
          ],
        },
      })
      .exec();
    if (exists.length === 0) {
      await db.clinical_documents.insert(
        doc as unknown as ClinicalDocumentType
      );
    }
  });
  return await Promise.all(saveTaskList);
}

export async function syncAllRecords(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>
): Promise<unknown[][]> {
  const newCd = connectionDocument.toMutableJSON();
  newCd.last_refreshed = new Date().toISOString();
  const immMapper = (dr: BundleEntry<Immunization>) =>
    DSTU2.mapImmunizationToClinicalDocument(dr, connectionDocument.toJSON());
  const procMapper = (proc: BundleEntry<Procedure>) =>
    DSTU2.mapProcedureToClinicalDocument(proc, connectionDocument.toJSON());
  const patientMapper = (pt: BundleEntry<Patient>) =>
    DSTU2.mapPatientToClinicalDocument(pt, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    DSTU2.mapObservationToClinicalDocument(imm, connectionDocument.toJSON());
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    DSTU2.mapDiagnosticReportToClinicalDocument(
      dr,
      connectionDocument.toJSON()
    );
  const medStatementMapper = (dr: BundleEntry<MedicationStatement>) =>
    DSTU2.mapMedicationStatementToClinicalDocument(
      dr,
      connectionDocument.toJSON()
    );
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    DSTU2.mapConditionToClinicalDocument(dr, connectionDocument.toJSON());
  const syncJob = await Promise.all([
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
    db.connection_documents.upsert(newCd).then(() => []),
  ]);

  return syncJob;
}
