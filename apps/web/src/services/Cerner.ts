/**
 * Functions related to authenticating against the Cerner patient portal and syncing data
 */

/* eslint-disable no-inner-declarations */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  Condition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  Immunization,
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
} from 'fhir/r2';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../components/providers/DatabaseCollections';
import {
  CernerConnectionDocument,
  ConnectionDocument,
  CreateCernerConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';
import { Routes } from '../Routes';
import { DSTU2 } from '.';
import Config from '../environments/config.json';
import { JsonWebKeySet } from './JWTTools';
import { UserDocument } from '../models/user-document/UserDocument.type';
import uuid4 from '../utils/UUIDUtils';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../models/clinical-document/ClinicalDocument.type';

export enum CernerLocalStorageKeys {
  CERNER_BASE_URL = 'cernerBaseUrl',
  CERNER_AUTH_URL = 'cernerAuthUrl',
  CERNER_TOKEN_URL = 'cernerTokenUrl',
  CERNER_NAME = 'cernerName',
  CERNER_ID = 'cernerId',
}

export function getLoginUrl(
  baseUrl: string,
  authorizeUrl: string,
): string & Location {
  const params = {
    client_id: `${Config.CERNER_CLIENT_ID}`,
    scope: [
      'fhirUser',
      'offline_access',
      'openid',
      'user/AllergyIntolerance.read',
      'user/Appointment.read',
      'user/Binary.read',
      'user/CarePlan.read',
      'user/CareTeam.read',
      'user/Condition.read',
      'user/DiagnosticReport.read',
      'user/DocumentReference.read',
      'user/Device.read',
      'user/Encounter.read',
      'user/Goal.read',
      'user/Immunization.read',
      'user/MedicationAdministration.read',
      'user/MedicationRequest.read',
      'user/MedicationStatement.read',
      'user/Observation.read',
      'user/Patient.read',
      'user/Practitioner.read',
      'user/Procedure.read',
    ].join(' '),
    redirect_uri: `${Config.PUBLIC_URL}${Routes.CernerCallback}`,
    aud: baseUrl,
    response_type: 'code',
  };

  return `${authorizeUrl}?${new URLSearchParams(params)}` as string & Location;
}

function parseIdToken(token: string) {
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
      .join(''),
  );

  return JSON.parse(jsonPayload) as {
    sub: string;
    aud: string;
    profile: string;
    iss: string;
    name: string;
    exp: number;
    iat: number;
    fhirUser: string;
    email: string;
  };
}

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  const defaultUrl = `${baseUrl}${fhirResourceUrl}?${new URLSearchParams(
    params,
  )}`;

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
 * @param mapper Function to map the FHIR resource to a CreateClinicalDocument
 * @param params Query parameters to pass to the FHIR request
 * @returns
 */
async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: CernerConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<T>(
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
  connectionDocument: CernerConnectionDocument,
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

  const encounterMapper = (a: BundleEntry<Encounter>) =>
    DSTU2.mapEncounterToClinicalDocument(a, connectionDocument);

  const patientId = parseIdToken(connectionDocument.id_token)
    .fhirUser.split('/')
    .slice(-1)[0];

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
      'Patient',
      patientMapper,
      {
        id: patientId,
      },
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
    syncDocumentReferences(baseUrl, connectionDocument, db, {
      patient: patientId,
    }),
    syncFHIRResource<Encounter>(
      baseUrl,
      connectionDocument,
      db,
      'Encounter',
      encounterMapper,
      {
        patient: patientId,
      },
    ),
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
  connectionDocument: CernerConnectionDocument,
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
    (doc) =>
      doc.toMutableJSON() as unknown as CreateClinicalDocument<
        BundleEntry<DocumentReference>
      >,
  );
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachmentUrls = docRefItem.data_record.raw.resource?.content.map(
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
                  {
                    connection_record_id: `${docRefItem.connection_record_id}`,
                  },
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
              // save as CreateClinicalDocument
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
                    docRefItem.data_record.raw.resource?.created ||
                    docRefItem.data_record.raw.resource?.context?.period?.start,
                  display_name:
                    docRefItem.data_record.raw.resource?.type?.text ||
                    docRefItem.metadata?.display_name,
                },
              };

              await db.clinical_documents.insert(
                cd as unknown as ClinicalDocument<string | Blob>,
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
  cd: CernerConnectionDocument,
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
 * Using the code from the Cerner callback, fetch the access token
 * @param code code from the Cerner callback, usually a query param
 * @param CernerUrl url of the Cerner server we are connecting to
 * @param CernerName user friendly name of the Cerner server we are connecting to
 * @returns Promise of the auth response from the Cerner server
 */
export async function fetchAccessTokenWithCode(
  code: string,
  cernerTokenUrl: string,
): Promise<CernerAuthResponse> {
  const defaultUrl = `${cernerTokenUrl}`;
  const res = await fetch(defaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: `${Config.CERNER_CLIENT_ID}`,
      redirect_uri: `${Config.PUBLIC_URL}${Routes.CernerCallback}`,
      code: code,
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
  cernerTokenUrl: string,
): Promise<CernerAuthResponse> {
  const defaultUrl = cernerTokenUrl;
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
  cernerBaseUrl,
  db,
  user,
}: {
  res: CernerAuthResponseWithClientId | CernerAuthResponse;
  cernerBaseUrl: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl<CernerConnectionDocument>(
    cernerBaseUrl,
    db,
  );
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
                expires_at: nowInSeconds + res.expires_in,
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
        const dbentry: Omit<CreateCernerConnectionDocument, 'refresh_token'> = {
          id: uuid4(),
          user_id: user.id,
          source: 'cerner',
          location: cernerBaseUrl,
          name: 'Cerner',
          access_token: res.access_token,
          expires_at: nowInSeconds + res.expires_in,
          scope: res.scope,
          id_token: res.id_token,
          auth_uri:
            'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
          token_uri:
            'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
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
export async function refreshCernerConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_at') <= nowInSeconds) {
    try {
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
        cernerBaseUrl: baseUrl,
        db,
        user,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token  - try logging in again');
    }
  }
}

export interface CernerAuthResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

export interface CernerAuthResponseWithClientId extends CernerAuthResponse {
  client_id: string;
}

export interface CernerDynamicRegistrationResponse {
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  software_id: string;
  client_id: string;
  client_id_issued_at: number;
  jwks: JsonWebKeySet;
}

export interface CernerDynamicRegistrationRequest {
  software_id: string;
  jwks: JsonWebKeySet;
}
