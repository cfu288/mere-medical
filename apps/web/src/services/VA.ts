/* eslint-disable no-inner-declarations */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  Condition,
  DiagnosticReport,
  DocumentReference,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
} from 'fhir/r2';
import { RxDocument, RxDatabase } from 'rxdb';
import {
  ConnectionDocument,
  CreateVAConnectionDocument,
  VAConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';
import { Routes } from '../Routes';
import { DSTU2 } from '.';
import Config from '../environments/config.json';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../models/user-document/UserDocument.type';
import uuid4 from '../utils/UUIDUtils';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';

export enum VALocalStorageKeys {
  VA_BASE_URL = 'vaBaseUrl',
  VA_AUTH_URL = 'vaAuthUrl',
  VA_TOKEN_URL = 'vaTokenUrl',
  VA_NAME = 'vaName',
  VA_ID = 'vaId',
}

export const VA_BASE_URL = 'https://sandbox-api.va.gov/services/fhir/v0';
export const VA_AUTH_URL =
  'https://sandbox-api.va.gov/oauth2/health/v1/authorization';
export const VA_TOKEN_URL = 'https://sandbox-api.va.gov/oauth2/health/v1/token';

export function getDSTU2Url(baseUrl = VA_BASE_URL) {
  return `${baseUrl}/dstu2/`;
}

export async function getLoginUrl(
  authorizeUrl = VA_AUTH_URL,
): Promise<string & Location> {
  const params = {
    client_id: `${Config.VA_CLIENT_ID}`,
    redirect_uri: `${Config.PUBLIC_URL}${Routes.VACallback}`,
    response_type: 'code',
    scope: [
      'profile',
      'openid',
      'offline_access',
      'launch/patient',
      'patient/AllergyIntolerance.read',
      'patient/Appointment.read',
      'patient/Binary.read',
      'patient/Condition.read',
      'patient/Device.read',
      'patient/DeviceRequest.read',
      'patient/DiagnosticReport.read',
      'patient/DocumentReference.read',
      'patient/Encounter.read',
      'patient/Immunization.read',
      'patient/Location.read',
      'patient/Medication.read',
      'patient/MedicationOrder.read',
      'patient/MedicationRequest.read',
      'patient/MedicationStatement.read',
      'patient/Observation.read',
      'patient/Organization.read',
      'patient/Patient.read',
      'patient/Practitioner.read',
      'patient/PractitionerRole.read',
      'patient/Procedure.read',
    ].join(' '),
    state: getOAuth2State(),
    code_challenge_method: 'S256',
    code_challenge: await getCodeChallenge(),
  };

  return `${authorizeUrl}?${new URLSearchParams(params)}` as string & Location;
}

export function getOAuth2State() {
  // Store in session storage a hex string generated by webcrypto
  const state = sessionStorage.getItem('oauth2-state');
  if (state) {
    return state;
  }
  const randBytes = window.crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(randBytes, (byte) => byte.toString(16)).join('');
  sessionStorage.setItem('oauth2-state', hex);
  return hex;
}

/**
 * Sometimes bundles may only return a subset of the total results
 * ex: {
 * "resourceType": "Bundle",
 * "type": "searchset",
 * "total": 7034,
 * "entry": [
 * ... only has subset of total results ...
 * ],
 * }
 * We want to iterate through all the pages using the ?page=<number>
 * query param until we've gotten all the results
 * This should iterate through pages 1 to N and call getFHIRResource for each page
 * */
async function getAllFHIRResourcesWithPaging<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  let page = 0;
  let totalEntriesCount = 0;

  const allEntries: BundleEntry<T>[] = [];
  do {
    page++;
    const entries = await getFHIRResource<T>(
      baseUrl,
      connectionDocument,
      fhirResourceUrl,
      {
        ...params,
        page: `${page}`,
        _count: 1000,
      },
    );
    totalEntriesCount = entries.length;
    allEntries.push(...entries);
  } while (totalEntriesCount > 0);
  return allEntries;
}

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, any>,
): Promise<BundleEntry<T>[]> {
  const defaultUrl = `${baseUrl}${fhirResourceUrl}${
    !params ? '' : `?${new URLSearchParams(params)}`
  }`;

  const res = await fetch(defaultUrl, {
    headers: {
      Authorization: `Bearer ${connectionDocument.access_token}`,
      Accept: 'application/json+fhir',
    },
  })
    .then((res) => res.json())
    .then((res: Bundle) => res);

  if (res.entry) {
    return res.entry as BundleEntry<T>[];
  }
  return [];
}

/**
 * Sync a FHIR resource to the database
 * @param baseUrl Base url of the FHIR server
 * @param connectionDocument RxDocument of the connection document
 * @param db RxDatabase to save to
 * @param fhirResourceUrl URL path FHIR resource to sync. e.g. Patient, Procedure, etc. Exclude the leading slash.
 * @param mapper Function to map the FHIR resource to a ClinicalDocument
 * @param params Query parameters to pass to the FHIR request
 * @returns
 */
async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>,
) {
  const resc = await getAllFHIRResourcesWithPaging<T>(
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
  );

  const cds = resc
    .filter(
      (i) =>
        i.resource?.resourceType.toLowerCase() ===
        fhirResourceUrl.toLowerCase(),
    )
    .map(mapper);
  const cdsmap = await db.clinical_documents.bulkUpsert(
    cds as unknown as ClinicalDocument[],
  );
  return cdsmap;
}

/**
 * Sync all records from the FHIR server to the local database
 * @param baseUrl Base url of the FHIR server to sync from
 * @param connectionDocument
 * @param db
 * @param useProxy
 * @returns A promise of void arrays
 */
export async function syncAllRecords(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
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

  const patientId = (connectionDocument as VAConnectionDocument).patient;

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Patient>(
      baseUrl,
      connectionDocument,
      db,
      `Patient/${patientId}`,
      patientMapper,
    ),
    syncFHIRResource<Observation>(
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<DiagnosticReport>(
      baseUrl,
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<MedicationStatement>(
      baseUrl,
      connectionDocument,
      db,
      'MedicationStatement',
      medStatementMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Immunization>(
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper,
      {
        patient: patientId,
      },
    ),
    syncFHIRResource<Condition>(
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper,
      {
        patient: patientId,
      },
    ),
    // syncDocumentReferences(baseUrl, connectionDocument, db, {
    //   patient: patientId,
    // }),
    syncFHIRResource<AllergyIntolerance>(
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper,
      {
        patient: patientId,
      },
    ),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: VAConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
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
    params,
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
    (doc: { toMutableJSON: () => unknown }) =>
      doc.toMutableJSON() as unknown as ClinicalDocument<
        BundleEntry<DocumentReference>
      >,
  );
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (item) => {
    const attachmentUrls = item.data_record.raw.resource?.content.map(
      (a) => a.attachment.url,
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
              connectionDocument,
            );
            if (raw && contentType) {
              // save as ClinicalDocument
              const cd: CreateClinicalDocument<string | Blob> = {
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
                cd as unknown as ClinicalDocument,
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

/**
 * Fetch attachment data from the FHIR server
 * @param url URL of the attachment
 * @param cd
 * @returns
 */
async function fetchAttachmentData(
  url: string,
  cd: VAConnectionDocument,
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cd.access_token}`,
      },
    });
    if (!res.ok) {
      throw new Error(
        'Could not get document as the user is unauthorized. Try logging in again.',
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
      'Could not get document as the user is unauthorized. Try logging in again.',
    );
  }
}

/**
 * Using the code from the VA callback, fetch the access token
 * @param code code from the VA callback, usually a query param
 * @param VAUrl url of the VA server we are connecting to
 * @param VAName user friendly name of the VA server we are connecting to
 * @returns Promise of the auth response from the VA server
 */
export async function fetchAccessTokenWithCode(
  code: string,
  vaTokenUrl: string,
): Promise<VAAuthResponse> {
  const defaultUrl = `${vaTokenUrl}`;
  const res = await fetch(defaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: `${Config.VA_CLIENT_ID}`,
      redirect_uri: `${Config.PUBLIC_URL}${Routes.VACallback}`,
      code: code,
      code_verifier: getCodeVerifier(),
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting authorization token ');
  }
  return res.json();
}

export async function fetchAccessTokenWithRefreshToken(
  refreshToken: string,
  vaTokenUrl: string,
): Promise<VAAuthResponse> {
  const defaultUrl = vaTokenUrl;
  const res = await fetch(defaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting authorization token ');
  }
  return res.json();
}

export async function getConnectionCardByUrl<T extends ConnectionDocument>(
  url: string,
  db: RxDatabase<DatabaseCollections>,
): Promise<RxDocument<T>> {
  return db.connection_documents
    .findOne({
      selector: { location: url },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<T>);
}

export async function saveConnectionToDb({
  res,
  vaBaseUrl,
  db,
  user,
}: {
  res: VAAuthResponse;
  vaBaseUrl: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl<VAConnectionDocument>(vaBaseUrl, db);
  return new Promise((resolve, reject) => {
    if (res?.access_token && res?.expires_in && res?.id_token) {
      if (doc) {
        // If we already have a connection card for this URL, update it
        try {
          const nowInSeconds = Math.floor(Date.now() / 1000);
          doc
            .update({
              $set: {
                access_token: res.access_token,
                expires_in: nowInSeconds + res.expires_in,
                scope: res.scope,
                last_sync_was_error: false,
              },
            })
            .then(() => {
              console.log('Updated connection card');
              console.log(doc.toJSON());
              resolve(true);
            })
            .catch((e) => {
              console.error(e);
              reject(new Error('Error updating connection'));
            });
        } catch (e) {
          console.error(e);
          reject(new Error('Error updating connection'));
        }
      } else {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        // Otherwise, create a new connection card
        const dbentry: CreateVAConnectionDocument = {
          id: uuid4(),
          user_id: user.id,
          source: 'va',
          location: getDSTU2Url(),
          name: "VA's Sandbox API",
          access_token: res.access_token,
          patient: res.patient,
          scope: res.scope,
          id_token: res.id_token,
          refresh_token: res.refresh_token,
          expires_at: nowInSeconds + res.expires_in,
          auth_uri: VA_AUTH_URL,
          token_uri: VA_TOKEN_URL,
        };
        try {
          db.connection_documents.insert(dbentry).then(() => {
            resolve(true);
          });
        } catch (e) {
          console.error(e);
          reject(new Error('Error updating connection'));
        }
      }
    } else {
      reject(
        new Error('Error completing authentication: no access token provided'),
      );
    }
  });
}

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param connectionDocument the connection document to refresh the access token for
 * @param db
 */
export async function refreshVAConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  try {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (connectionDocument.get('expires_in') <= nowInSeconds) {
      const baseUrl = connectionDocument.get('location'),
        refreshToken = connectionDocument.get('refresh_token'),
        tokenUri = connectionDocument.get('token_uri'),
        user = connectionDocument.get('user_id');

      const access_token_data = await fetchAccessTokenWithRefreshToken(
        refreshToken,
        tokenUri,
      );

      return await saveConnectionToDb({
        res: access_token_data,
        vaBaseUrl: baseUrl,
        db,
        user,
      });
    }
    return Promise.resolve();
  } catch (e) {
    console.error(e);
    throw new Error('Error refreshing token  - try logging in again');
  }
}

export interface VAAuthResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  state: string;
  token_type: string;
  patient: string;
}

// GENERATING CODE VERIFIER
function dec2hex(dec: number) {
  return ('0' + dec.toString(16)).substr(-2);
}

function generateCodeVerifier() {
  const array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

//get from session storage
// if does not exist, generate and save to session storage
function getCodeVerifier() {
  const codeVerifier = sessionStorage.getItem('code_verifier');
  if (codeVerifier) {
    return codeVerifier;
  }
  const generatedCodeVerifier = generateCodeVerifier();
  sessionStorage.setItem('code_verifier', generatedCodeVerifier);
  return generatedCodeVerifier;
}

// GENERATING CODE CHALLENGE FROM VERIFIER
function sha256(plain: string) {
  // returns promise ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a: ArrayBuffer) {
  let str = '';
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallengeFromVerifier(v: string) {
  const hashed = await sha256(v);
  const base64encoded = base64urlencode(hashed);
  return base64encoded;
}

async function getCodeChallenge() {
  try {
    const codeVerifier = getCodeVerifier();
    const codeChallenge = await generateCodeChallengeFromVerifier(codeVerifier);
    return codeChallenge;
  } catch (e) {
    console.log(e);
    throw new Error('Error generating code challenge');
  }
}
