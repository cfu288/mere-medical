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
  CreateAthenaConnectionDocument,
  AthenaConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { Routes } from '../../Routes';
import { R4 } from '.';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import {
  createConnection,
  findConnectionByTenant,
  updateConnection,
} from '../../repositories/ConnectionRepository';
import { findUserById } from '../../repositories/UserRepository';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import uuid4 from '../../shared/utils/UUIDUtils';
import {
  ClinicalDocument,
  CreateClinicalDocument,
} from '../../models/clinical-document/ClinicalDocument.type';
import {
  createAthenaClient,
  buildAthenaOAuthConfig,
  getAthenaEnvironmentConfig,
  createSessionManager,
  type AthenaTokenSet,
} from '@mere/fhir-oauth';

export {
  createAthenaClient,
  buildAthenaOAuthConfig,
  getAthenaEnvironmentConfig,
  ATHENA_DEFAULT_SCOPES,
  type AthenaClient,
  type AthenaTokenSet,
  type AthenaOAuthConfigOptions,
} from '@mere/fhir-oauth';

const athenaClient = createAthenaClient();
const athenaSession = createSessionManager('athena');

export enum AthenaLocalStorageKeys {
  ATHENA_ENVIRONMENT = 'athenaEnvironment',
}

export async function getLoginUrl(
  config: AppConfig,
  environment: 'preview' | 'production',
): Promise<string> {
  const clientId =
    environment === 'preview'
      ? config.ATHENA_SANDBOX_CLIENT_ID
      : config.ATHENA_CLIENT_ID;

  if (!clientId || !config.PUBLIC_URL) {
    throw new Error('Athena OAuth configuration is incomplete');
  }

  const oauthConfig = buildAthenaOAuthConfig({
    clientId,
    publicUrl: config.PUBLIC_URL,
    redirectPath: Routes.AthenaCallback,
    environment,
  });

  const { url, session } = await athenaClient.initiateAuth(oauthConfig);
  await athenaSession.save(session);
  return url;
}

function parseJwtPayload<T>(token: string): T {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
  return JSON.parse(jsonPayload);
}

function getAhPracticeFromToken(accessToken: string): string | undefined {
  try {
    const payload = parseJwtPayload<{ ah_practice?: string }>(accessToken);
    return payload.ah_practice;
  } catch {
    return undefined;
  }
}

function buildAhPracticeParam(accessToken?: string): string | undefined {
  if (!accessToken) return undefined;
  const ahPractice = getAhPracticeFromToken(accessToken);
  if (!ahPractice) return undefined;
  return `Organization/${ahPractice}`;
}

/**
 * Fetches FHIR resources from Athena's API using the global URL with ah-practice parameter.
 *
 * The ah-practice parameter format is: Organization/a-1.Practice-{practiceId}
 * The `/` in the value must NOT be URL-encoded.
 *
 * @see https://docs.athenahealth.com/api/guides/base-fhir-urls
 * @see https://docs.athenahealth.com/api/guides/testing-sandbox
 */
async function getFHIRResource<T extends FhirResource>(
  connectionDocument: AthenaConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  const baseUrl = connectionDocument.location as string;
  const ahPractice = buildAhPracticeParam(connectionDocument.access_token);

  const searchParams = new URLSearchParams(params);
  let defaultUrl = `${baseUrl}/${fhirResourceUrl}`;

  const existingParams = searchParams.toString();
  if (existingParams || ahPractice) {
    defaultUrl += '?';
    if (existingParams) {
      defaultUrl += existingParams;
    }
    if (ahPractice) {
      defaultUrl += existingParams
        ? `&ah-practice=${ahPractice}`
        : `ah-practice=${ahPractice}`;
    }
  }

  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined = defaultUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
        Accept: 'application/fhir+json',
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
    nextUrl = nextLink?.url;
  }

  return allEntries;
}

async function syncFHIRResource<T extends FhirResource>(
  connectionDocument: AthenaConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: (proc: BundleEntry<T>) => CreateClinicalDocument<BundleEntry<T>>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<T>(
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

export async function syncAllRecords(
  connectionDocument: AthenaConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
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

  const patientId = connectionDocument.patient;

  const syncJob = await Promise.allSettled([
    syncFHIRResource<Procedure>(
      connectionDocument,
      db,
      'Procedure',
      procMapper as any,
      { patient: patientId },
    ),
    syncFHIRResource<Patient>(
      connectionDocument,
      db,
      'Patient',
      patientMapper as any,
      { _id: patientId },
    ),
    syncFHIRResource<Observation>(
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      { patient: patientId, category: 'laboratory' },
    ),
    syncFHIRResource<DiagnosticReport>(
      connectionDocument,
      db,
      'DiagnosticReport',
      drMapper as any,
      { patient: patientId },
    ),
    syncFHIRResource<any>(
      connectionDocument,
      db,
      'MedicationRequest',
      medRequestMapper as any,
      { patient: patientId },
    ),
    syncFHIRResource<Immunization>(
      connectionDocument,
      db,
      'Immunization',
      immMapper as any,
      { patient: patientId },
    ),
    syncFHIRResource<Condition>(
      connectionDocument,
      db,
      'Condition',
      conditionMapper as any,
      { patient: patientId },
    ),
    syncDocumentReferences(connectionDocument, db, { patient: patientId }),
    syncFHIRResource<Encounter>(
      connectionDocument,
      db,
      'Encounter',
      encounterMapper as any,
      { patient: patientId },
    ),
    syncFHIRResource<AllergyIntolerance>(
      connectionDocument,
      db,
      'AllergyIntolerance',
      allergyIntoleranceMapper as any,
      { patient: patientId },
    ),
    syncFHIRResource(
      connectionDocument,
      db,
      'CareTeam',
      ((item: any) =>
        R4.mapCareTeamToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
    ),
    syncFHIRResource(
      connectionDocument,
      db,
      'Goal',
      ((item: any) =>
        R4.mapGoalToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
    ),
    syncFHIRResource(
      connectionDocument,
      db,
      'CarePlan',
      ((item: any) =>
        R4.mapCarePlanToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
    ),
    syncFHIRResource(
      connectionDocument,
      db,
      'Device',
      ((item: any) =>
        R4.mapDeviceToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
    ),
    syncFHIRResource<Observation>(
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      { patient: patientId, category: 'vital-signs' },
    ),
    syncFHIRResource<Observation>(
      connectionDocument,
      db,
      'Observation',
      obsMapper as any,
      { patient: patientId, category: 'social-history' },
    ),
    syncFHIRResource(
      connectionDocument,
      db,
      'Provenance',
      ((item: any) =>
        R4.mapProvenanceToClinicalDocument(item, connectionDocument)) as any,
      { patient: patientId },
    ),
  ]);

  return syncJob as unknown as Promise<PromiseSettledResult<void[]>[]>;
}

async function syncDocumentReferences(
  connectionDocument: AthenaConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
) {
  const documentReferenceMapper = (dr: BundleEntry<DocumentReference>) =>
    R4.mapDocumentReferenceToClinicalDocument(dr, connectionDocument);
  await syncFHIRResource<DocumentReference>(
    connectionDocument,
    db,
    'DocumentReference',
    documentReferenceMapper as any,
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
              attachmentUrl,
              connectionDocument,
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
  url: string,
  cd: AthenaConnectionDocument,
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const isBinaryResource = url.includes('/Binary/');
    const acceptHeader = isBinaryResource ? 'application/fhir+json' : '*/*';

    const isRelativeUrl =
      !url.startsWith('http://') && !url.startsWith('https://');
    const baseUrl = cd.location as string;
    let fullUrl = isRelativeUrl ? `${baseUrl}/${url}` : url;

    const ahPractice = buildAhPracticeParam(cd.access_token);
    if (ahPractice) {
      const separator = fullUrl.includes('?') ? '&' : '?';
      fullUrl += `${separator}ah-practice=${ahPractice}`;
    }

    const res = await fetch(fullUrl, {
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

async function fetchOrganizationName(
  accessToken: string,
  fhirBaseUrl: string,
  patientId: string,
): Promise<string> {
  const ahPractice = getAhPracticeFromToken(accessToken);
  if (!ahPractice) return 'Athena Health';

  const practiceId = ahPractice.split('Practice-')[1];
  if (practiceId) {
    try {
      const response = await fetch(
        `/api/v1/athena/organizations/${practiceId}`,
      );
      if (response.ok) {
        const org = await response.json();
        if (org?.name) {
          return org.name;
        }
      }
    } catch (e) {
      console.warn(
        'Failed to fetch organization from API, trying Patient resource',
        e,
      );
    }
  }

  try {
    const url = `${fhirBaseUrl}/Patient/${patientId}?ah-practice=Organization/${ahPractice}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json',
      },
    });
    if (!response.ok) return 'Athena Health';
    const patient = await response.json();
    return patient.managingOrganization?.display || 'Athena Health';
  } catch {
    return 'Athena Health';
  }
}

export async function saveConnectionToDb({
  tokens,
  environment,
  db,
  user,
}: {
  tokens: AthenaTokenSet;
  environment: 'preview' | 'production';
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  if (!tokens?.accessToken) {
    throw new Error(
      'Error completing authentication: no access token provided',
    );
  }

  const ahPractice =
    (tokens.raw?.['ah_practice'] as string | undefined) ??
    getAhPracticeFromToken(tokens.accessToken);

  if (!ahPractice) {
    throw new Error(
      'Missing ah_practice claim — cannot identify Athena practice',
    );
  }

  const envConfig = getAthenaEnvironmentConfig(environment);

  const existing = await findConnectionByTenant(
    db,
    user.id,
    'athena',
    ahPractice,
    envConfig.fhirBaseUrl,
  );

  const organizationName = await fetchOrganizationName(
    tokens.accessToken,
    envConfig.fhirBaseUrl,
    tokens.patientId,
  );

  if (existing) {
    const updateData: Partial<AthenaConnectionDocument> = {
      access_token: tokens.accessToken,
      expires_at: tokens.expiresAt,
      scope: tokens.scope,
      patient: tokens.patientId,
      last_sync_was_error: false,
      name: organizationName,
    };

    if (tokens.idToken) {
      updateData.id_token = tokens.idToken;
    }

    if (tokens.refreshToken) {
      updateData.refresh_token = tokens.refreshToken;
    }

    await updateConnection(db, user.id, existing.id, updateData);
  } else {
    const dbentry: CreateAthenaConnectionDocument = {
      id: uuid4(),
      user_id: user.id,
      source: 'athena',
      location: envConfig.fhirBaseUrl,
      name: organizationName,
      access_token: tokens.accessToken,
      expires_at: tokens.expiresAt,
      scope: tokens.scope,
      id_token: tokens.idToken,
      refresh_token: tokens.refreshToken,
      patient: tokens.patientId,
      tenant_id: ahPractice,
      environment,
      auth_uri: envConfig.authUrl,
      token_uri: envConfig.tokenUrl,
    };
    await createConnection(db, dbentry as ConnectionDocument);
  }
}

export async function refreshAthenaConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<ConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (connectionDocument.get('expires_at') <= nowInSeconds) {
    const refreshToken = connectionDocument.get('refresh_token');
    if (!refreshToken) {
      throw new Error('Login expired - login required in order to sync data');
    }

    try {
      const userId = connectionDocument.get('user_id');
      const patientId = connectionDocument.get('patient');
      const scope = connectionDocument.get('scope');
      const idToken = connectionDocument.get('id_token');
      const environment = connectionDocument.get('environment') as
        | 'preview'
        | 'production'
        | undefined;

      if (!environment) {
        throw new Error(
          'Connection missing environment field - please reconnect',
        );
      }

      const userObject = await findUserById(db, userId);

      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      const clientId =
        environment === 'preview'
          ? config.ATHENA_SANDBOX_CLIENT_ID
          : config.ATHENA_CLIENT_ID;

      if (!clientId) {
        throw new Error('Athena client ID not configured');
      }

      const client = createAthenaClient();

      const oauthConfig = buildAthenaOAuthConfig({
        clientId,
        publicUrl: config.PUBLIC_URL || '',
        redirectPath: Routes.AthenaCallback,
        environment,
      });

      const currentTokens: AthenaTokenSet = {
        accessToken: connectionDocument.get('access_token'),
        expiresAt: connectionDocument.get('expires_at'),
        idToken,
        refreshToken,
        scope,
        patientId,
        raw: {},
      };

      const newTokens = await client.refresh(currentTokens, oauthConfig);

      if (!newTokens.raw?.['ah_practice']) {
        const existingTenantId = connectionDocument.get('tenant_id');
        if (existingTenantId) {
          newTokens.raw = {
            ...newTokens.raw,
            ah_practice: existingTenantId,
          };
        }
      }

      return await saveConnectionToDb({
        tokens: newTokens,
        environment,
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
