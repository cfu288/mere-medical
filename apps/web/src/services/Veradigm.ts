import Config from '../environments/config.json';
import { Routes } from '../Routes';
import { DSTU2 } from '.';
import { VeradigmConnectionDocument } from '../models/connection-document/ConnectionDocument.type';
import {
  FhirResource,
  BundleEntry,
  Procedure,
  Patient,
  Observation,
  DiagnosticReport,
  MedicationStatement,
  Immunization,
  Condition,
  AllergyIntolerance,
  Bundle,
  DocumentReference,
} from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/RxDbProvider';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';

export enum VeradigmLocalStorageKeys {
  VERADIGM_BASE_URL = 'veradigmBaseUrl',
  VERADIGM_AUTH_URL = 'veradigmAuthUrl',
  VERADIGM_TOKEN_URL = 'veradigmTokenUrl',
  VERADIGM_NAME = 'veradigmName',
  VERADIGM_ID = 'veradigmId',
}

/** Professional 20.1 SANDBOX FollowMyHEalth
 * Patient Access
Property	Value	Notes
FHIR Base Url	https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CustProProdSand201SMART	Utilize the "/metadata" Conformance call to understand the resources availble in this API.
OAuth Authorization URL	https://open.allscripts.com/fhirroute/fmhpatientauth/0cd760ae-6ec5-4137-bf26-4269636b94ef/connect/authorize	
OAuth Token URL	https://open.allscripts.com/fhirroute/fmhpatientauth/0cd760ae-6ec5-4137-bf26-4269636b94ef/connect/token	
OAuth Scope	One or more of the values from the Smart on FHIR Scopes	If you are unsure, use "launch user/*.read" for user access.
Patient Username	donna.dobson_prounityfhir	Patient id is 19
Patient Password	Allscripts#1	
 */

/** TouchWorks 20.0 SANDBOX Allscripts Connect
 * Patient Access
Property	Value	Notes
FHIR Base Url	https://tw181unityfhir.open.allscripts.com/open	Utilize the "/metadata" Conformance call to understand the resources availble in this API.
OAuth Authorization URL	https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/authorize	
OAuth Token URL	https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/token	
OAuth Scope	One or more of the values from the Smart on FHIR Scopes	If you are unsure, use "launch user/*.read" for user access.
Patient Username	allison.allscripts@tw181unityfhir.edu	Patient id is 19
Patient Password	Allscripts#1	
 */

export function getLoginUrl(
  baseUrl: string,
  authorizeUrl: string
): string & Location {
  const params = {
    client_id: `${Config.VERADIGM_CLIENT_ID}`,
    scope: ['launch/patient', 'openid', 'profile', 'user/*.read'].join(' '),
    redirect_uri: `${Config.PUBLIC_URL}${Routes.VeradigmCallback}`,
    aud: baseUrl,
    response_type: 'code',
  };

  if (authorizeUrl?.endsWith('/')) {
    return `${authorizeUrl.substring(
      0,
      authorizeUrl.length - 1
    )}?${new URLSearchParams(params)}` as string & Location;
  }

  return `${authorizeUrl}?${new URLSearchParams(params)}` as string & Location;
}

export async function fetchAccessTokenWithCode(
  code: string,
  veradigmTokenUrl: string
): Promise<VeradigmAuthResponse> {
  const defaultUrl = `${veradigmTokenUrl}`;
  const res = await fetch(defaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: `${Config.VERADIGM_CLIENT_ID}`,
      redirect_uri: `${Config.PUBLIC_URL}${Routes.VeradigmCallback}`,
      code: code,
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting authorization token ');
  }
  return res.json();
}

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>
): Promise<BundleEntry<T>[]> {
  const defaultUrl = params
    ? `${baseUrl}${fhirResourceUrl}?${new URLSearchParams(params)}`
    : `${baseUrl}${fhirResourceUrl}`;

  const res = await fetch(defaultUrl, {
    headers: {
      Authorization: `Bearer ${connectionDocument.access_token}`,
      Accept: 'application/json+fhir',
    },
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting FHIR resource');
  }
  const bundle = await res.json();
  if (bundle.entry) {
    return bundle.entry as BundleEntry<T>[];
  }
  return [];
}

async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => ClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>
) {
  const resc = await getFHIRResource<T>(
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params
  );

  const cds = resc
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

function parseAccessToken(token: string) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    // eslint-disable-next-line no-restricted-globals
    self
      .atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );

  return JSON.parse(jsonPayload) as {
    iss: string;
    aud: string;
    exp: number;
    nbf: number;
    sub: string;
    fhir_api_id: string;
    global_patient_id: string;
    preferred_username: string;
    local_patient_id: string;
    client_id: string;
    scope: string[];
    auth_time: number;
    idp: string;
    amr: string[];
  };
}

export async function syncAllRecords(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>
): Promise<PromiseSettledResult<void[]>[]> {
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
  const immMapper = (dr: BundleEntry<Immunization>) =>
    DSTU2.mapImmunizationToClinicalDocument(dr, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    DSTU2.mapConditionToClinicalDocument(dr, connectionDocument);
  const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
    DSTU2.mapAllergyIntoleranceToClinicalDocument(a, connectionDocument);

  const patientId = parseAccessToken(
    connectionDocument.access_token
  ).local_patient_id;

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper,
      {
        patient: patientId,
      }
    ),
    syncFHIRResource<Patient>(
      baseUrl,
      connectionDocument,
      db,
      'Patient',
      patientMapper,
      {
        _id: patientId,
      }
    ),
    syncFHIRResource<Observation>(
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper,
      {
        patient: patientId,
        category: 'laboratory',
      }
    ),
    syncFHIRResource<DiagnosticReport>(
      baseUrl,
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper,
      {
        patient: patientId,
      }
    ),
    syncFHIRResource<MedicationStatement>(
      baseUrl,
      connectionDocument,
      db,
      'MedicationStatement',
      medStatementMapper,
      {
        patient: patientId,
      }
    ),
    syncFHIRResource<Immunization>(
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper,
      {
        patient: patientId,
      }
    ),
    syncFHIRResource<Condition>(
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper,
      {
        patient: patientId,
      }
    ),
    syncDocumentReferences(baseUrl, connectionDocument, db, {
      patient: patientId,
    }),
    syncFHIRResource<AllergyIntolerance>(
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper,
      {
        patient: patientId,
      }
    ),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>
) {
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    DSTU2.mapDocumentReferenceToClinicalDocument(dr, connectionDocument);
  // Sync document references and return them
  await syncFHIRResource<DocumentReference>(
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper,
    params
  );

  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: connectionDocument.user_id,
        'data_record.resource_type': {
          $eq: 'documentreference',
        },
        connection_record_id: `${connectionDocument.id}`,
      },
    })
    .exec();

  // format all the document references
  const docRefItems = docs.map(
    (doc) =>
      doc.toMutableJSON() as unknown as ClinicalDocument<
        BundleEntry<DocumentReference>
      >
  );
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (item) => {
    const attachmentUrls = item.data_record.raw.resource?.content.map(
      (a) => a.attachment.url
    );
    if (attachmentUrls) {
      for (const attachmentUrl of attachmentUrls) {
        if (attachmentUrl) {
          const exists = await db.clinical_documents
            .find({
              selector: {
                $and: [
                  { user_id: connectionDocument.user_id },
                  { 'metadata.id': `${attachmentUrl}` },
                  { connection_record_id: `${item.connection_record_id}` },
                ],
              },
            })
            .exec();
          if (exists.length === 0) {
            console.log('Syncing attachment: ' + attachmentUrl);
            // attachment does not exist, sync it
            const { contentType, raw } = await fetchAttachmentData(
              attachmentUrl,
              connectionDocument
            );
            if (raw && contentType) {
              const cd: ClinicalDocument = {
                user_id: connectionDocument.user_id,
                connection_record_id: connectionDocument.id,
                data_record: {
                  raw: raw,
                  format: 'FHIR.DSTU2',
                  content_type: contentType,
                  resource_type: 'documentreference_attachment',
                  version_history: [],
                },
                metadata: {
                  id: attachmentUrl,
                  date:
                    item.data_record.raw.resource?.created ||
                    item.data_record.raw.resource?.context?.period?.start,
                  display_name: item.data_record.raw.resource?.type?.text,
                },
              };

              await db.clinical_documents.insert(
                cd as unknown as ClinicalDocument
              );
            }
          } else {
            console.log('Attachment already synced: ' + attachmentUrl);
          }
        }
      }
    }
  });
  return await Promise.all(cdsmap);
}

async function fetchAttachmentData(
  url: string,
  cd: VeradigmConnectionDocument
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cd.access_token}`,
      },
    });
    if (!res.ok) {
      throw new Error(
        'Could not get document as the user is unauthorized. Try logging in again.'
      );
    }
    const contentType = res.headers.get('Content-Type');
    let raw = undefined;
    if (contentType === 'application/xml') {
      raw = await res.text();
    }

    if (contentType === 'application/pdf') {
      raw = await res.blob();
    }

    return { contentType, raw };
  } catch (e) {
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.'
    );
  }
}

export interface VeradigmAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  id_token: string;
}
