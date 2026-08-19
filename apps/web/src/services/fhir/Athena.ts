import {
  Attachment,
  Bundle,
  BundleEntry,
  DocumentReference,
  Encounter,
  FhirResource,
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
import { CreateClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import {
  createAthenaClient,
  buildAthenaOAuthConfig,
  getAthenaEnvironmentConfig,
  createSessionManager,
  parseJwtPayload,
  type AthenaTokenSet,
} from '@mere/fhir-oauth';
import {
  mapEntries,
  mapIncludedEntries,
  ResourceMapper,
  VendorSync,
} from './sync';

export {
  createAthenaClient,
  buildAthenaOAuthConfig,
  getAthenaEnvironmentConfig,
  ATHENA_DEFAULT_SCOPES,
  type AthenaClient,
  type AthenaTokenSet,
  type AthenaOAuthConfigOptions,
} from '@mere/fhir-oauth';
import {
  bulkUpsertDocuments,
  createDocument,
  documentExistsByMetadataId,
  findDocumentsByResourceType,
} from '../../repositories/ClinicalDocumentRepository';

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

function getAhPracticeFromToken(accessToken: string): string | undefined {
  try {
    const payload = parseJwtPayload<{ ah_practice?: string }>(accessToken);
    return payload.ah_practice;
  } catch {
    return undefined;
  }
}

const AH_PRACTICE_PATTERN = /^a-\d+\.Practice-\d+$/;

function validateAhPracticeFormat(value: string): boolean {
  if (!AH_PRACTICE_PATTERN.test(value)) {
    console.warn(
      `Unexpected ah_practice format: "${value}" — expected pattern: a-{num}.Practice-{num}`,
    );
    return false;
  }
  return true;
}

function buildAhPracticeParam(accessToken?: string): string | undefined {
  if (!accessToken) return undefined;
  const ahPractice = getAhPracticeFromToken(accessToken);
  if (!ahPractice) return undefined;
  validateAhPracticeFormat(ahPractice);
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
  mapper: ResourceMapper<BundleEntry<T>, AthenaConnectionDocument>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<T>(
    connectionDocument,
    fhirResourceUrl,
    params,
  );

  return bulkUpsertDocuments(
    db,
    mapEntries(resc, fhirResourceUrl, mapper, connectionDocument),
  );
}

async function syncFHIRResourceWithIncludes<T extends FhirResource>(
  connectionDocument: AthenaConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: ResourceMapper<BundleEntry<T>, AthenaConnectionDocument>,
  params: Record<string, string>,
  includeMappers: Record<
    string,
    ResourceMapper<BundleEntry<any>, AthenaConnectionDocument>
  >,
) {
  const resc = await getFHIRResource<T>(
    connectionDocument,
    fhirResourceUrl,
    params,
  );

  await bulkUpsertDocuments(
    db,
    mapEntries(resc, fhirResourceUrl, mapper, connectionDocument),
  );
  await bulkUpsertDocuments(
    db,
    mapIncludedEntries(
      resc,
      includeMappers,
      connectionDocument,
      fhirResourceUrl,
    ),
  );
}

export const sync: VendorSync = {
  refreshToken: ({ config, connection, db }) =>
    refreshAthenaConnectionTokenIfNeeded(config, connection, db),
  syncAllRecords: ({ connection, db }) => {
    const cd =
      connection.toMutableJSON() as unknown as AthenaConnectionDocument;
    const patient = cd.patient;
    return Promise.allSettled([
      syncFHIRResource(cd, db, 'Procedure', R4.mapProcedureToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'Patient', R4.mapPatientToClinicalDocument, {
        _id: patient,
      }),
      syncFHIRResource(
        cd,
        db,
        'Observation',
        R4.mapObservationToClinicalDocument,
        { patient, category: 'laboratory' },
      ),
      syncFHIRResource(
        cd,
        db,
        'DiagnosticReport',
        R4.mapDiagnosticReportToClinicalDocument,
        { patient },
      ),
      // Athena requires [patient, intent] or [_id] per {baseUrl}/metadata
      syncFHIRResource(
        cd,
        db,
        'MedicationRequest',
        R4.mapMedicationRequestToClinicalDocument,
        { patient, intent: 'order' },
      ),
      syncFHIRResource(
        cd,
        db,
        'Immunization',
        R4.mapImmunizationToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(cd, db, 'Condition', R4.mapConditionToClinicalDocument, {
        patient,
      }),
      syncDocumentReferences(cd, db, { patient }),
      // Athena only supports searching Provenance by target per {baseUrl}/metadata,
      // so Provenance records are pulled in via _revinclude instead
      syncFHIRResourceWithIncludes<Encounter>(
        cd,
        db,
        'Encounter',
        R4.mapEncounterToClinicalDocument,
        { patient, _revinclude: 'Provenance:target' },
        { Provenance: R4.mapProvenanceToClinicalDocument },
      ),
      syncFHIRResource(
        cd,
        db,
        'AllergyIntolerance',
        R4.mapAllergyIntoleranceToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(cd, db, 'CareTeam', R4.mapCareTeamToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'Goal', R4.mapGoalToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'CarePlan', R4.mapCarePlanToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'Device', R4.mapDeviceToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(
        cd,
        db,
        'Observation',
        R4.mapObservationToClinicalDocument,
        { patient, category: 'vital-signs' },
      ),
      syncFHIRResource(
        cd,
        db,
        'Observation',
        R4.mapObservationToClinicalDocument,
        { patient, category: 'social-history' },
      ),
    ]);
  },
};

/**
 * Syncs DocumentReferences and stores their attachment content as
 * documentreference_attachment documents. Athena delivers content to
 * patient-access apps inline as base64 Attachment.data rather than a
 * fetchable url (Binary retrieval requires system scopes, and documents not
 * published to the Patient Portal come back with a data-absent-reason).
 * Inline attachments are keyed by `{DocumentReference metadata.id}/attachment`
 * since the DocumentReference itself already claims its own metadata.id.
 *
 * @see https://docs.athenahealth.com/api/workflows/fhir-r4-lab-and-imaging-documentation-retrieval
 * @see https://docs.athenahealth.com/api/workflows/fhir-r4-api-patient-portal-access-to-documents-sensitive-result-filtering
 */
async function syncDocumentReferences(
  connectionDocument: AthenaConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
) {
  await syncFHIRResource<DocumentReference>(
    connectionDocument,
    db,
    'DocumentReference',
    R4.mapDocumentReferenceToClinicalDocument,
    params,
  );

  const docRefItems = await findDocumentsByResourceType<
    BundleEntry<DocumentReference>
  >(db, connectionDocument.user_id, connectionDocument.id, 'documentreference');
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachments =
      docRefItem.data_record.raw.resource?.content.map((a) => a.attachment) ||
      [];
    for (const attachment of attachments) {
      const attachmentUrl = attachment.url;
      const attachmentId =
        attachmentUrl ||
        (attachment.data && docRefItem.metadata?.id
          ? `${docRefItem.metadata.id}/attachment`
          : null);
      if (attachmentId) {
        const exists = await documentExistsByMetadataId(
          db,
          connectionDocument.user_id,
          docRefItem.connection_record_id,
          attachmentId,
        );
        if (!exists) {
          const { contentType, raw } = attachmentUrl
            ? await fetchAttachmentData(attachmentUrl, connectionDocument)
            : decodeInlineAttachmentData(attachment);
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
                id: attachmentId,
                date:
                  docRefItem.data_record.raw.resource?.date ||
                  docRefItem.data_record.raw.resource?.context?.period?.start,
                display_name:
                  docRefItem.data_record.raw.resource?.type?.text ||
                  docRefItem.metadata?.display_name,
              },
            };

            await createDocument(db, cd);
          }
        }
      }
    }
  });
  return await Promise.all(cdsmap);
}

/**
 * Decodes inline base64 Attachment.data, following the same storage
 * conventions as fetchAttachmentData: PDFs stay base64-encoded, XML and
 * text content is decoded to plain strings.
 */
function decodeInlineAttachmentData(attachment: Attachment): {
  contentType: string | null;
  raw: string | undefined;
} {
  const contentType = attachment.contentType || null;
  if (!attachment.data || !contentType) {
    return { contentType, raw: undefined };
  }
  try {
    if (
      contentType.includes('application/xml') ||
      contentType.includes('text')
    ) {
      return { contentType, raw: atob(attachment.data) };
    }
    return { contentType, raw: attachment.data };
  } catch (e) {
    console.error('Error decoding inline attachment data', e);
    return { contentType, raw: undefined };
  }
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
    if (!response.ok) {
      console.warn(
        `Failed to fetch Patient resource for org name: ${response.status}`,
      );
      return 'Athena Health';
    }
    const patient = await response.json();
    return patient.managingOrganization?.display || 'Athena Health';
  } catch (e) {
    console.warn('Failed to fetch organization name from Patient resource', e);
    return 'Athena Health';
  }
}

export async function saveConnectionToDb({
  tokens,
  environment,
  db,
  user,
  ahPractice: ahPracticeOverride,
}: {
  tokens: AthenaTokenSet;
  environment: 'preview' | 'production';
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  ahPractice?: string;
}) {
  if (!tokens?.accessToken) {
    throw new Error(
      'Error completing authentication: no access token provided',
    );
  }

  const ahPractice =
    ahPracticeOverride ??
    (tokens.raw?.['ah_practice'] as string | undefined) ??
    getAhPracticeFromToken(tokens.accessToken);

  if (!ahPractice) {
    throw new Error(
      'Missing ah_practice claim — cannot identify Athena practice',
    );
  }

  validateAhPracticeFormat(ahPractice);

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
      fhir_version: 'R4',
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

      if (!patientId) {
        throw new Error('Connection missing patient ID — please reconnect');
      }

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

      const newTokens = await athenaClient.refresh(currentTokens, oauthConfig);

      return await saveConnectionToDb({
        tokens: newTokens,
        environment,
        db,
        user: userObject,
        ahPractice: connectionDocument.get('tenant_id') as string | undefined,
      });
    } catch (e) {
      console.error(e);
      throw new Error('Error refreshing token - try logging in again');
    }
  }
  return Promise.resolve();
}
