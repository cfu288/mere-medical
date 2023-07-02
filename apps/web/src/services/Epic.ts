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

export function getDSTU2Url(baseUrl: string) {
  return `${baseUrl}/api/FHIR/DSTU2`;
}

export function getLoginUrl(
  baseUrl: string,
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

  return `${baseUrl}/oauth2/authorize?${new URLSearchParams(
    params
  )}` as string & Location;
}

export enum EpicLocalStorageKeys {
  EPIC_URL = 'epicUrl',
  EPIC_NAME = 'epicName',
  EPIC_ID = 'epicId',
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
): Promise<PromiseSettledResult<void[]>[] | any> {
  const newCd = connectionDocument;
  newCd.last_refreshed = new Date().toISOString();

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

  await db.connection_documents.upsert(newCd).then(() => []);

  return syncJob;
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
      epicId === 'sandbox' ? Config.EPIC_SANDBOX_CLIENT_ID : epicId
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
 * @param epicUrl url of the Epic server we are connecting to
 * @param epicName user friendly name of the Epic server we are connecting to
 * @returns Promise of the auth response from the Epic server
 */
export async function fetchAccessTokenWithCode(
  code: string,
  epicUrl: string,
  epicName: string,
  epicId?: string,
  useProxy = false
): Promise<EpicAuthResponse> {
  const defaultUrl = `${epicUrl}/oauth2/token`;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target=/oauth2/token`;
  const res = await fetch(useProxy ? proxyUrl : defaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: `${
        epicId === 'sandbox'
          ? Config.EPIC_SANDBOX_CLIENT_ID
          : Config.EPIC_CLIENT_ID
      }`,
      redirect_uri: `${Config.PUBLIC_URL}${Routes.EpicCallback}`,
      code: code,
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting authorization token in ' + epicName);
  }
  return res.json();
}

export async function registerDynamicClient({
  res,
  epicUrl,
  epicName,
  epicId,
  useProxy = false,
}: {
  res: EpicAuthResponse;
  epicUrl: string;
  epicName: string;
  epicId?: string;
  useProxy?: boolean;
}): Promise<EpicDynamicRegistrationResponse> {
  const defaultUrl = `${epicUrl}/oauth2/register`;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target=/oauth2/register`;

  const jsonWebKeySet = await getPublicKey();
  const validJWKS = jsonWebKeySet as JsonWebKeyWKid;
  const request: EpicDynamicRegistrationRequest = {
    software_id:
      epicId === 'sandbox'
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
  epicUrl: string,
  epicId?: string,
  useProxy = false
): Promise<EpicAuthResponseWithClientId> {
  const defaultUrl = `${epicUrl}/oauth2/token`;
  const proxyUrl = `${Config.PUBLIC_URL}/api/proxy?serviceId=${epicId}&target=/oauth2/token`;

  // We've registered, now we can get another access token with our signed JWT
  const jwtBody = {
    sub: clientId,
    iss: clientId,
    aud: `${epicUrl}/oauth2/token`,
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

export async function getConnectionCardByUrl(
  url: string,
  db: RxDatabase<DatabaseCollections>
) {
  return db.connection_documents
    .findOne({
      selector: { location: url },
    })
    .exec()
    .then((list) => list as unknown as RxDocument<EpicConnectionDocument>);
}

export async function saveConnectionToDb({
  res,
  epicUrl,
  epicName,
  db,
  epicId,
  user,
}: {
  res: EpicAuthResponseWithClientId | EpicAuthResponse;
  epicUrl: string;
  epicName: string;
  db: RxDatabase<DatabaseCollections>;
  epicId: string;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl(epicUrl, db);
  return new Promise((resolve, reject) => {
    if (res?.access_token && res?.expires_in && res?.patient) {
      if (doc) {
        // If we already have a connection card for this URL, update it
        try {
          const nowInSeconds = Math.floor(Date.now() / 1000);
          doc
            .update({
              $set: {
                client_id:
                  (res as EpicAuthResponseWithClientId)?.client_id ||
                  doc.client_id,
                access_token: res.access_token,
                expires_in: nowInSeconds + res.expires_in,
                scope: res.scope,
                patient: res.patient,
                tenant_id: epicId,
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
        const dbentry: Omit<CreateEpicConnectionDocument, 'refresh_token'> = {
          id: uuid4(),
          user_id: user.id,
          source: 'epic',
          location: epicUrl,
          name: epicName,
          access_token: res.access_token,
          expires_in: nowInSeconds + res.expires_in,
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
        epicName = connectionDocument.get('name'),
        clientId = connectionDocument.get('client_id'),
        epicId = connectionDocument.get('tenant_id'),
        user = connectionDocument.get('user_id');

      const access_token_data = await fetchAccessTokenUsingJWT(
        clientId,
        epicUrl,
        epicId,
        useProxy
      );

      return await saveConnectionToDb({
        res: access_token_data,
        epicUrl,
        epicName,
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
