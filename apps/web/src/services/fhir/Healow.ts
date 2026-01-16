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
  Observation,
  Patient,
  Procedure,
} from 'fhir/r4';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  ConnectionDocument,
  CreateHealowConnectionDocument,
  HealowConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { Routes } from '../../Routes';
import { R4 } from '.';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import { createConnection } from '../../repositories/ConnectionRepository';
import { findUserById } from '../../repositories/UserRepository';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import uuid4 from '../../shared/utils/UUIDUtils';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';
import { concatPath } from '../../shared/utils/urlUtils';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';

export enum HealowLocalStorageKeys {
  HEALOW_BASE_URL = 'healowBaseUrl',
  HEALOW_AUTH_URL = 'healowAuthUrl',
  HEALOW_TOKEN_URL = 'healowTokenUrl',
  HEALOW_NAME = 'healowName',
  HEALOW_ID = 'healowId',
}

function dec2hex(dec: number) {
  return ('0' + dec.toString(16)).slice(-2);
}

function generateCodeVerifier() {
  const array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

function getCodeVerifier() {
  const codeVerifier = sessionStorage.getItem('healow_code_verifier');
  if (codeVerifier) {
    return codeVerifier;
  }
  const generatedCodeVerifier = generateCodeVerifier();
  sessionStorage.setItem('healow_code_verifier', generatedCodeVerifier);
  return generatedCodeVerifier;
}

function sha256(plain: string) {
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
  const codeVerifier = getCodeVerifier();
  const codeChallenge = await generateCodeChallengeFromVerifier(codeVerifier);
  return codeChallenge;
}

function getOAuth2State() {
  const state = sessionStorage.getItem('healow_oauth2_state');
  if (state) {
    return state;
  }
  const randBytes = window.crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(randBytes, (byte) => byte.toString(16)).join('');
  sessionStorage.setItem('healow_oauth2_state', hex);
  return hex;
}

export async function getLoginUrl(
  config: AppConfig,
  baseUrl: string,
  authorizeUrl: string,
): Promise<string & Location> {
  const params = {
    client_id: `${config.HEALOW_CLIENT_ID}`,
    scope: [
      'openid',
      'fhirUser',
      'patient/AllergyIntolerance.read',
      'patient/CarePlan.read',
      'patient/CareTeam.read',
      'patient/Condition.read',
      'patient/Device.read',
      'patient/DiagnosticReport.read',
      'patient/DocumentReference.read',
      'patient/Binary.read',
      'patient/Encounter.read',
      'patient/Goal.read',
      'patient/Immunization.read',
      'patient/MedicationAdministration.read',
      'patient/MedicationRequest.read',
      'patient/Observation.read',
      'patient/Organization.read',
      'patient/Patient.read',
      'patient/Practitioner.read',
      'patient/PractitionerRole.read',
      'patient/Procedure.read',
      'patient/Provenance.read',
      'patient/Medication.read',
      'patient/Location.read',
    ].join(' '),
    redirect_uri: concatPath(config.PUBLIC_URL || '', Routes.HealowCallback),
    aud: baseUrl,
    response_type: 'code',
    state: getOAuth2State(),
    code_challenge: await getCodeChallenge(),
    code_challenge_method: 'S256',
  };

  return `${authorizeUrl}?${new URLSearchParams(params)}` as string & Location;
}

function parseIdToken(token: string) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
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
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
  useProxy = true,
): Promise<BundleEntry<T>[]> {
  const searchParams = new URLSearchParams(params);
  const defaultUrl = `${concatPath(baseUrl, fhirResourceUrl)}?${searchParams}`;
  const proxyUrl = concatPath(
    publicUrl || '',
    `/api/proxy?vendor=healow&serviceId=${connectionDocument.tenant_id}&target=${encodeURIComponent(
      `${fhirResourceUrl}?${searchParams}`,
    )}&target_type=base`,
  );

  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined = useProxy ? proxyUrl : defaultUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
        Accept: 'application/json+fhir',
      },
    });
    if (!response.ok) {
      console.error(await response.text());
      throw new Error('Error getting FHIR resource');
    }
    const bundle: Bundle = await response.json();

    if (bundle.entry) {
      allEntries = allEntries.concat(bundle.entry as BundleEntry<T>[]);
    }

    const nextLink = bundle.link?.find(
      (link: { relation?: string; url?: string }) => link.relation === 'next',
    );
    if (nextLink?.url && useProxy) {
      const nextPath =
        new URL(nextLink.url).pathname + new URL(nextLink.url).search;
      nextUrl = concatPath(
        publicUrl || '',
        `/api/proxy?vendor=healow&serviceId=${connectionDocument.tenant_id}&target=${encodeURIComponent(
          nextPath,
        )}&target_type=base`,
      );
    } else {
      nextUrl = nextLink?.url;
    }
  }

  return allEntries;
}

async function syncFHIRResource<T extends FhirResource>(
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>,
  useProxy = true,
) {
  const resc = await getFHIRResource<T>(
    publicUrl,
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
    useProxy,
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

export async function syncAllRecords(
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  useProxy = true,
): Promise<PromiseSettledResult<void[]>[]> {
  const procMapper = (proc: BundleEntry<Procedure>) =>
    R4.mapProcedureToClinicalDocument(proc, connectionDocument);
  const patientMapper = (pt: BundleEntry<Patient>) =>
    R4.mapPatientToClinicalDocument(pt, connectionDocument);
  const obsMapper = (imm: BundleEntry<Observation>) =>
    R4.mapObservationToClinicalDocument(imm, connectionDocument);
  const drMapper = (dr: BundleEntry<DiagnosticReport>) =>
    R4.mapDiagnosticReportToClinicalDocument(dr, connectionDocument);
  const medRequestMapper = (dr: BundleEntry<any>) =>
    R4.mapMedicationRequestToClinicalDocument(dr, connectionDocument);
  const immMapper = (dr: BundleEntry<Immunization>) =>
    R4.mapImmunizationToClinicalDocument(dr, connectionDocument);
  const conditionMapper = (dr: BundleEntry<Condition>) =>
    R4.mapConditionToClinicalDocument(dr, connectionDocument);
  const allergyIntoleranceMapper = (a: BundleEntry<AllergyIntolerance>) =>
    R4.mapAllergyIntoleranceToClinicalDocument(a, connectionDocument);
  const encounterMapper = (a: BundleEntry<Encounter>) =>
    R4.mapEncounterToClinicalDocument(a, connectionDocument);

  const patientId = parseIdToken(connectionDocument.id_token)
    .fhirUser.split('/')
    .slice(-1)[0];

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Procedure',
      procMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<Patient>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Patient',
      patientMapper as any,
      { _id: patientId },
      useProxy,
    ),
    syncFHIRResource<Observation>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      { patient: patientId, category: 'laboratory' },
      useProxy,
    ),
    syncFHIRResource<DiagnosticReport>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<any>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'MedicationRequest',
      medRequestMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<Immunization>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Immunization',
      immMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<Condition>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Condition',
      conditionMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncDocumentReferences(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      {
        patient: patientId,
      },
      useProxy,
    ),
    syncFHIRResource<Encounter>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Encounter',
      encounterMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource<AllergyIntolerance>(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'CareTeam',
      ((item: any) =>
        R4.mapCareTeamToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Goal',
      ((item: any) =>
        R4.mapGoalToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'CarePlan',
      ((item: any) =>
        R4.mapCarePlanToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
    syncFHIRResource(
      publicUrl,
      baseUrl,
      connectionDocument,
      db,
      'Device',
      ((item: any) =>
        R4.mapDeviceToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
      useProxy,
    ),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  publicUrl: string,
  baseUrl: string,
  connectionDocument: HealowConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
  useProxy = true,
) {
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    R4.mapDocumentReferenceToClinicalDocument(dr, connectionDocument);
  await syncFHIRResource<DocumentReference>(
    publicUrl,
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper as any,
    params,
    useProxy,
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

  const docRefItems = docs.map(
    (doc) =>
      doc.toMutableJSON() as unknown as CreateClinicalDocument<
        BundleEntry<DocumentReference>
      >,
  );
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
            const { contentType, raw } = await fetchAttachmentData(
              publicUrl,
              attachmentUrl,
              connectionDocument,
              useProxy,
            );
            if (raw && contentType) {
              const cd: CreateClinicalDocument<string | Blob> = {
                user_id: connectionDocument.user_id,
                connection_record_id: connectionDocument.id,
                data_record: {
                  raw: raw,
                  format: 'FHIR.R4',
                  content_type: contentType,
                  resource_type: 'documentreference_attachment',
                  version_history: [],
                },
                metadata: {
                  id: attachmentUrl,
                  date:
                    docRefItem.data_record.raw.resource?.date ||
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
          }
        }
      }
    }
  });
  return await Promise.all(cdsmap);
}

async function fetchAttachmentData(
  publicUrl: string,
  url: string,
  cd: HealowConnectionDocument,
  useProxy = true,
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const isBinaryResource = url.includes('/Binary/');
    const acceptHeader = isBinaryResource ? 'application/fhir+json' : '*/*';

    const urlPath = new URL(url).pathname + new URL(url).search;
    const proxyUrl = concatPath(
      publicUrl || '',
      `/api/proxy?vendor=healow&serviceId=${cd.tenant_id}&target=${encodeURIComponent(
        urlPath,
      )}&target_type=base`,
    );

    const res = await fetch(useProxy ? proxyUrl : url, {
      headers: {
        Authorization: `Bearer ${cd.access_token}`,
        Accept: acceptHeader,
      },
    });
    if (!res.ok) {
      throw new Error(
        'Could not get document as the user is unauthorized. Try logging in again.',
      );
    }
    const contentType = res.headers.get('Content-Type');
    let raw = undefined;

    if (
      contentType?.includes('application/fhir+json') ||
      contentType?.includes('application/json+fhir')
    ) {
      const binaryResource = await res.json();
      if (binaryResource.data) {
        const actualContentType =
          binaryResource.contentType || 'application/octet-stream';

        if (actualContentType === 'application/pdf') {
          raw = binaryResource.data;
        } else if (
          actualContentType === 'application/xml' ||
          actualContentType.includes('text')
        ) {
          raw = atob(binaryResource.data);
        } else {
          raw = binaryResource.data;
        }

        return { contentType: actualContentType, raw };
      }
    } else if (contentType === 'application/xml') {
      raw = await res.text();
    }

    return { contentType, raw };
  } catch (e) {
    throw new Error(
      'Could not get document as the user is unauthorized. Try logging in again.',
    );
  }
}

export async function fetchAccessTokenWithCode(
  code: string,
  healowTokenUrl: string,
  clientId: string,
  redirectUri: string,
  healowId?: string,
  useProxy = false,
): Promise<HealowAuthResponse> {
  const publicUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const proxyUrl = concatPath(
    publicUrl || '',
    `/api/proxy?vendor=healow&serviceId=${healowId}&target_type=token`,
  );
  const res = await fetch(useProxy ? proxyUrl : healowTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: getCodeVerifier(),
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    throw new Error('Error getting authorization token');
  }
  return res.json();
}

export async function fetchAccessTokenWithRefreshToken(
  refreshToken: string,
  healowTokenUrl: string,
): Promise<HealowAuthResponse> {
  const defaultUrl = healowTokenUrl;
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
    throw new Error('Error getting authorization token');
  }
  return res.json();
}

export async function saveConnectionToDb({
  res,
  healowBaseUrl,
  healowName,
  healowAuthUrl,
  healowTokenUrl,
  healowId,
  db,
  user,
}: {
  res: HealowAuthResponse;
  healowBaseUrl: string;
  healowName: string;
  healowAuthUrl: string;
  healowTokenUrl: string;
  healowId: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  const doc = await getConnectionCardByUrl<HealowConnectionDocument>(
    healowBaseUrl,
    db,
    user.id,
  );
  return new Promise((resolve, reject) => {
    if (res?.access_token && res?.expires_in) {
      if (doc) {
        try {
          const nowInSeconds = Math.floor(Date.now() / 1000);
          const updateData: Record<string, unknown> = {
            access_token: res.access_token,
            expires_at: nowInSeconds + res.expires_in,
            scope: res.scope,
            last_sync_was_error: false,
          };

          if (res.id_token) {
            updateData['id_token'] = res.id_token;
          }

          doc
            .update({
              $set: updateData,
            })
            .then(() => {
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
        if (!res.id_token) {
          reject(
            new Error('Connection document not found during token refresh'),
          );
          return;
        }

        const nowInSeconds = Math.floor(Date.now() / 1000);
        const dbentry: CreateHealowConnectionDocument = {
          id: uuid4(),
          user_id: user.id,
          source: 'healow',
          location: healowBaseUrl,
          name: healowName,
          access_token: res.access_token,
          expires_at: nowInSeconds + res.expires_in,
          scope: res.scope,
          id_token: res.id_token,
          refresh_token: res.refresh_token,
          auth_uri: healowAuthUrl,
          token_uri: healowTokenUrl,
          tenant_id: healowId,
        };
        try {
          createConnection(db, dbentry as ConnectionDocument)
            .then(() => {
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
      }
    } else {
      reject(
        new Error('Error completing authentication: no access token provided'),
      );
    }
  });
}

export async function refreshHealowConnectionTokenIfNeeded(
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_at') <= nowInSeconds) {
    try {
      const baseUrl = connectionDocument.get('location'),
        refreshToken = connectionDocument.get('refresh_token'),
        tokenUri = connectionDocument.get('token_uri'),
        authUri = connectionDocument.get('auth_uri'),
        name = connectionDocument.get('name'),
        userId = connectionDocument.get('user_id'),
        tenantId = connectionDocument.get('tenant_id');

      const userObject = await findUserById(db, userId);

      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const access_token_data = await fetchAccessTokenWithRefreshToken(
        refreshToken,
        tokenUri,
      );

      return await saveConnectionToDb({
        res: access_token_data,
        healowBaseUrl: baseUrl,
        healowName: name,
        healowAuthUrl: authUri,
        healowTokenUrl: tokenUri,
        healowId: tenantId,
        db,
        user: userObject,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token - try logging in again');
    }
  }
  return Promise.resolve();
}

export interface HealowAuthResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  patient?: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
}
