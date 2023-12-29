/**
 * Functions related to authenticating against the Epic MyChart patient portal and syncing data
 */

/* eslint-disable no-inner-declarations */
import {
  AllergyIntolerance,
  Bundle,
  BundleEntry,
  CarePlan,
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
import { DatabaseCollections } from '../components/providers/RxDbProvider';
import {
  ConnectionDocument,
  CreateEpicConnectionDocument,
  EpicConnectionDocument,
} from '../models/connection-document/ConnectionDocument.type';
import { Routes } from '../Routes';
import { DSTU2 } from '.';
import Config from '../environments/config.json';
import uuid4 from '../utils/UUIDUtils';
import { JsonWebKeyWKid, signJwt } from './JWTTools';
import { getPublicKey, IDBKeyConfig } from './WebCrypto';
import { JsonWebKeySet } from '../services/JWTTools';
import { UserDocument } from '../models/user-document/UserDocument.type';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';

export function getDSTU2Url(baseUrl: string) {
  return isDSTU2Url(baseUrl)
    ? new URL(baseUrl).toString()
    : new URL('/api/FHIR/DSTU2', baseUrl).toString();
}

export function isDSTU2Url(url: string) {
  return url.includes('/api/FHIR/DSTU2');
}

export function getLoginUrl(
  baseUrl: string,
  authorizeUrl: string,
  isSandbox = false
): string & Location {
  const params = {
    client_id: `${
      isSandbox ? Config.EPIC_SANDBOX_CLIENT_ID : Config.EPIC_CLIENT_ID
    }`,
    scope: 'openid fhirUser',
    redirect_uri: `${Config.PUBLIC_URL}${Routes.EpicCallback}`,
    aud: getDSTU2Url(baseUrl),
    response_type: 'code',
  };

  // return `${baseUrl}/oauth2/authorize?${new URLSearchParams(
  //   params
  // )}` as string & Location;
  return `${authorizeUrl}?${new URLSearchParams(params)}` as string & Location;
}

export enum EpicLocalStorageKeys {
  EPIC_BASE_URL = 'epicUrl',
  EPIC_NAME = 'epicName',
  EPIC_ID = 'epicId',
  EPIC_AUTH_URL = 'epicAuthUrl',
  EPIC_TOKEN_URL = 'epicTokenUrl',
}

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
  useProxy = false
): Promise<BundleEntry<T>[]> {
  const epicId = connectionDocument.tenant_id;
  const defaultUrl = `${getDSTU2Url(
      baseUrl
    )}/${fhirResourceUrl}?${new URLSearchParams(params)}`,
    proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${
      epicId === Config.EPIC_SANDBOX_CLIENT_ID ? 'sandbox' : epicId
    }&target=${`${encodeURIComponent(
      `/api/FHIR/DSTU2/${fhirResourceUrl}?${new URLSearchParams(params)}`
    )}`}`;

  const res = await fetch(useProxy ? proxyUrl : defaultUrl, {
    headers: {
      Authorization: `Bearer ${connectionDocument.access_token}`,
      Accept: 'application/fhir+json',
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
 * @param connectionDocument EpicConnectionDocument connection document
 * @param db RxDatabase to save to
 * @param fhirResourceUrl URL path FHIR resource to sync. e.g. Patient, Procedure, etc. Exclude the leading slash.
 * @param mapper Function to map the FHIR resource to a ClinicalDocument
 * @param params Query parameters to pass to the FHIR request
 * @returns
 */
async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => ClinicalDocument<BundleEntry<T>>,
  params: Record<string, string>,
  useProxy = false
) {
  const resc = await getFHIRResource<T>(
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
    useProxy
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
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false
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
  const carePlanMapper = (dr: BundleEntry<CarePlan>) =>
    DSTU2.mapCarePlanToClinicalDocument(dr, connectionDocument);

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
    syncFHIRResource<Patient>(
      baseUrl,
      connectionDocument,
      db,
      'Patient',
      patientMapper,
      {
        id: connectionDocument.patient,
      },
      useProxy
    ),
    syncFHIRResource<Observation>(
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper,
      {
        patient: connectionDocument.patient,
        category: 'laboratory',
      },
      useProxy
    ),
    syncFHIRResource<DiagnosticReport>(
      baseUrl,
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
    syncFHIRResource<MedicationStatement>(
      baseUrl,
      connectionDocument,
      db,
      'MedicationStatement',
      medStatementMapper,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
    syncFHIRResource<Immunization>(
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
    syncFHIRResource<Condition>(
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
    syncDocumentReferences(
      baseUrl,
      connectionDocument,
      db,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
    syncFHIRResource<CarePlan>(
      baseUrl,
      connectionDocument,
      db,
      'CarePlan',
      carePlanMapper,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
    syncFHIRResource<AllergyIntolerance>(
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper,
      {
        patient: connectionDocument.patient,
      },
      useProxy
    ),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: EpicConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  useProxy = false
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
    useProxy
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
              baseUrl,
              attachmentUrl,
              connectionDocument,
              useProxy
            );
            if (raw && contentType) {
              // save as ClinicalDocument
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

/**
 * Fetch attachment data from the FHIR server
 * @param url URL of the attachment
 * @param connectionDocument
 * @returns
 */
async function fetchAttachmentData(
  baseUrl: string,
  url: string,
  connectionDocument: EpicConnectionDocument,
  useProxy: boolean
): Promise<{ contentType: string | null; raw: string | undefined }> {
  try {
    const epicId = connectionDocument.tenant_id;
    const defaultUrl = url;
    const proxyUrlExtension = url.replace(baseUrl, '');
    const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${
      epicId === 'sandbox' || epicId === '7c3b7890-360d-4a60-9ae1-ca7d10d5b354'
        ? Config.EPIC_SANDBOX_CLIENT_ID
        : epicId
    }&target=${`${encodeURIComponent(proxyUrlExtension)}`}`;
    const res = await fetch(useProxy ? proxyUrl : defaultUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
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

    return { contentType, raw };
  } catch (e) {
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.'
    );
  }
}

/**
 * Using the code from the Epic callback, fetch the access token
 * @param code code from the Epic callback, usually a query param
 * @param epicTokenUrl url of the Epic server we are connecting to
 * @param epicName user friendly name of the Epic server we are connecting to
 * @returns Promise of the auth response from the Epic server
 */
export async function fetchAccessTokenWithCode(
  code: string,
  epicTokenUrl: string,
  epicName: string,
  epicId?: string,
  useProxy = false
): Promise<EpicAuthResponse> {
  const defaultUrl = epicTokenUrl;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target=/oauth2/token`;
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: `${
      epicId === 'sandbox' || epicId === '7c3b7890-360d-4a60-9ae1-ca7d10d5b354'
        ? Config.EPIC_SANDBOX_CLIENT_ID
        : Config.EPIC_CLIENT_ID
    }`,
    redirect_uri: `${Config.PUBLIC_URL}${Routes.EpicCallback}`,
    code: code,
  });
  const res = await fetch(useProxy ? proxyUrl : defaultUrl, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting authorization token in ' + epicName);
  }
  return res.json();
}

export async function registerDynamicClient({
  res,
  epicBaseUrl,
  epicName,
  epicId,
  useProxy = false,
}: {
  res: EpicAuthResponse;
  epicBaseUrl: string;
  epicName: string;
  epicId?: string;
  useProxy?: boolean;
}): Promise<EpicDynamicRegistrationResponse> {
  const baseUrlWithoutDSTU2 = epicBaseUrl.replace('/api/FHIR/DSTU2', '');
  const defaultUrl = `${baseUrlWithoutDSTU2}/oauth2/register`;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target=/oauth2/register`;

  const jsonWebKeySet = await getPublicKey();
  const validJWKS = jsonWebKeySet as JsonWebKeyWKid;
  const request: EpicDynamicRegistrationRequest = {
    software_id:
      epicId === 'sandbox' || epicId === '7c3b7890-360d-4a60-9ae1-ca7d10d5b354'
        ? Config.EPIC_SANDBOX_CLIENT_ID
        : Config.EPIC_CLIENT_ID,
    jwks: {
      keys: [
        {
          e: validJWKS.e,
          kty: validJWKS.kty,
          n: validJWKS.n,
          kid: `${IDBKeyConfig.KEY_ID}`,
        },
      ],
    },
  };
  // We've got a temp access token and public key, now we can register this app as a dynamic client
  try {
    const registerRes = await fetch(useProxy ? proxyUrl : defaultUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${res.access_token}`,
      },
      body: JSON.stringify(request),
    });

    if (!registerRes.ok) {
      if (registerRes.status === 404) {
        throw new DynamicRegistrationError(
          'This site does not support dynamic client registration.',
          res
        );
      }
      console.log(await registerRes.text());
      throw new Error('Error registering dynamic client with ' + epicName);
    }
    return await registerRes.json();
  } catch (e) {
    throw new DynamicRegistrationError(
      'This site does not support dynamic client registration.',
      res
    );
  }
}

export class DynamicRegistrationError extends Error {
  public data: EpicAuthResponse;

  constructor(message: string, data: EpicAuthResponse) {
    super(message);
    this.name = 'DynamicRegistrationError';
    this.data = data;
  }
}

export async function fetchAccessTokenUsingJWT(
  clientId: string,
  epicTokenUrl: string,
  epicId?: string,
  useProxy = false
): Promise<EpicAuthResponseWithClientId> {
  const defaultUrl = epicTokenUrl;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target=/oauth2/token`;

  // We've registered, now we can get another access token with our signed JWT
  const jwtBody = {
    sub: clientId,
    iss: clientId,
    aud: epicTokenUrl,
    jti: uuid4(),
  };
  const signedJwt = await signJwt(jwtBody);
  const tokenRes = await fetch(useProxy ? proxyUrl : defaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: clientId,
      assertion: signedJwt,
    }),
  });
  if (!tokenRes.ok) {
    console.log(await tokenRes.text());
    throw new Error('Error getting access token');
  }
  const result = await tokenRes.json();
  return { ...result, client_id: clientId };
}

export async function saveConnectionToDb({
  res,
  epicBaseUrl: epicUrl,
  epicTokenUrl,
  epicAuthUrl,
  epicName,
  db,
  epicId,
  user,
}: {
  res: EpicAuthResponseWithClientId | EpicAuthResponse;
  epicBaseUrl: string | Location;
  epicTokenUrl: string | Location;
  epicAuthUrl: string | Location;
  epicName: string;
  db: RxDatabase<DatabaseCollections>;
  epicId: string;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl<EpicConnectionDocument>(epicUrl, db);
  // handle when epicUrl used to only have the base, but now has 'api/FHIR/DSTU2' appended
  const docLegacy = await getConnectionCardByUrl<EpicConnectionDocument>(
    new URL('api/FHIR/DSTU2', epicUrl as string).toString(),
    db
  );
  return new Promise((resolve, reject) => {
    if (res?.access_token && res?.expires_in && res?.patient) {
      const currentDoc = doc || docLegacy;
      if (currentDoc) {
        // If we already have a connection card for this URL, update it
        try {
          const nowInSeconds = Math.floor(Date.now() / 1000);
          currentDoc
            .update({
              $set: {
                client_id:
                  (res as EpicAuthResponseWithClientId)?.client_id ||
                  currentDoc.client_id,
                location: epicUrl,
                auth_uri: epicAuthUrl,
                token_uri: epicTokenUrl,
                access_token: res.access_token,
                expires_at: nowInSeconds + res.expires_in,
                scope: res.scope,
                patient: res.patient,
                tenant_id: epicId,
                last_sync_was_error: false,
              },
            })
            .then(() => {
              console.log('Updated connection card');
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
        const dbentry: Omit<CreateEpicConnectionDocument, 'refresh_token'> = {
          id: uuid4(),
          user_id: user.id,
          source: 'epic',
          location: epicUrl,
          auth_uri: epicAuthUrl,
          token_uri: epicTokenUrl,
          name: epicName,
          access_token: res.access_token,
          expires_at: nowInSeconds + res.expires_in,
          scope: res.scope,
          patient: res.patient,
          client_id: (res as EpicAuthResponseWithClientId)?.client_id,
          tenant_id: epicId,
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
        new Error('Error completing authentication: no access token provided')
      );
    }
  });
}

/**
 * For a connection document, if the access token is expired, refresh it and save it to the db
 * @param connectionDocument the connection document to refresh the access token for
 * @param db
 */
export async function refreshEpicConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
  useProxy = false
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_in') <= nowInSeconds) {
    try {
      const epicUrl = connectionDocument.get('location'),
        epicTokenUrl = connectionDocument.get('token_uri'),
        epicAuthUrl = connectionDocument.get('auth_uri'),
        epicName = connectionDocument.get('name'),
        clientId = connectionDocument.get('client_id'),
        epicId = connectionDocument.get('tenant_id'),
        user = connectionDocument.get('user_id');

      const access_token_data = await fetchAccessTokenUsingJWT(
        clientId,
        epicTokenUrl,
        epicId,
        useProxy
      );

      return await saveConnectionToDb({
        res: access_token_data,
        epicBaseUrl: epicUrl,
        epicName,
        epicTokenUrl,
        epicAuthUrl,
        db,
        epicId,
        user,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token  - try logging in again');
    }
  }
}

export interface EpicAuthResponse {
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}

export interface EpicAuthResponseWithClientId extends EpicAuthResponse {
  client_id: string;
}

export interface EpicDynamicRegistrationResponse {
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  software_id: string;
  client_id: string;
  client_id_issued_at: number;
  jwks: JsonWebKeySet;
}

export interface EpicDynamicRegistrationRequest {
  software_id: string;
  jwks: JsonWebKeySet;
}
