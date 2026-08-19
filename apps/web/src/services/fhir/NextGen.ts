import {
  Attachment,
  Bundle,
  BundleEntry,
  DocumentReference,
  FhirResource,
} from 'fhir/r4';
import { RxDocument, RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  AnyConnectionDocument,
  CreateNextGenConnectionDocument,
  NextGenConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { Routes } from '../../Routes';
import { R4 } from '.';
import { AppConfig } from '../../app/providers/AppConfigProvider';
import {
  createConnection,
  findConnectionByTenant,
  updateConnection,
} from '../../repositories/ConnectionRepository';
import {
  bulkUpsertDocuments,
  createDocument,
  documentExistsByMetadataId,
  findDocumentsByResourceType,
} from '../../repositories/ClinicalDocumentRepository';
import { findUserById } from '../../repositories/UserRepository';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import uuid4 from '../../shared/utils/UUIDUtils';
import { CreateClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import {
  createNextGenClientConfidential,
  buildNextGenOAuthConfig,
  createSessionManager,
  isTokenExpired,
  resolveFhirUrl,
  NEXTGEN_CONSTANTS,
  type NextGenClient,
  type NextGenTokenSet,
} from '@mere/fhir-oauth';
import { mapSearchedResources, ResourceMapper, VendorSync } from './sync';

export {
  createNextGenClientConfidential,
  buildNextGenOAuthConfig,
  NEXTGEN_CONSTANTS,
  type NextGenClient,
  type NextGenTokenSet,
} from '@mere/fhir-oauth';

export function createNextGenClient(publicUrl: string): NextGenClient {
  return createNextGenClientConfidential({
    token: resolveFhirUrl(publicUrl, '/api/v1/nextgen/token'),
    refresh: resolveFhirUrl(publicUrl, '/api/v1/nextgen/refresh'),
  });
}

export async function getLoginUrl(
  clientId: string,
  publicUrl: string,
): Promise<string> {
  const oauthConfig = buildNextGenOAuthConfig({
    clientId,
    publicUrl,
    redirectPath: Routes.NextGenCallback,
  });

  const client = createNextGenClient(publicUrl);
  const session = createSessionManager('nextgen');
  const { url, session: authSession } = await client.initiateAuth(oauthConfig);
  await session.save(authSession);
  return url;
}

async function getFHIRResource<T extends FhirResource>(
  connectionDocument: NextGenConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  const baseUrl = connectionDocument.location as string;

  const searchParams = new URLSearchParams(params);
  let defaultUrl = resolveFhirUrl(baseUrl, fhirResourceUrl);
  const existingParams = searchParams.toString();
  if (existingParams) {
    defaultUrl += `?${existingParams}`;
  }

  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined = defaultUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${connectionDocument.access_token}`,
        Accept: 'application/json',
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
  connectionDocument: NextGenConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: ResourceMapper<BundleEntry<T>, NextGenConnectionDocument>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<T>(
    connectionDocument,
    fhirResourceUrl,
    params,
  );

  return bulkUpsertDocuments(
    db,
    mapSearchedResources(resc, fhirResourceUrl, mapper, connectionDocument),
  );
}

export const sync: VendorSync<NextGenConnectionDocument> = {
  refreshToken: ({ config, connection, db }) =>
    refreshNextGenConnectionTokenIfNeeded(config, connection, db),
  syncAllRecords: ({ document: cd, db }) => {
    const patient = cd.patient;
    return Promise.allSettled([
      syncFHIRResource(cd, db, 'Patient', R4.mapPatientToClinicalDocument, {
        _id: patient,
      }),
      syncFHIRResource(cd, db, 'Procedure', R4.mapProcedureToClinicalDocument, {
        patient,
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
      syncFHIRResource(cd, db, 'Condition', R4.mapConditionToClinicalDocument, {
        patient,
        category: 'encounter-diagnosis',
      }),
      syncFHIRResource(cd, db, 'Condition', R4.mapConditionToClinicalDocument, {
        patient,
        category: 'health-concern',
      }),
      syncFHIRResource(cd, db, 'Condition', R4.mapConditionToClinicalDocument, {
        patient,
        category: 'problem-list-item',
      }),
      syncFHIRResource(
        cd,
        db,
        'DiagnosticReport',
        R4.mapDiagnosticReportToClinicalDocument,
        { patient, category: 'lab' },
      ),
      syncFHIRResource(cd, db, 'CarePlan', R4.mapCarePlanToClinicalDocument, {
        patient,
        category: 'assess-plan',
      }),
      syncFHIRResource(
        cd,
        db,
        'MedicationRequest',
        R4.mapMedicationRequestToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        cd,
        db,
        'MedicationDispense',
        R4.mapMedicationDispenseToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        cd,
        db,
        'MedicationStatement',
        R4.mapMedicationStatementToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        cd,
        db,
        'Immunization',
        R4.mapImmunizationToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        cd,
        db,
        'AllergyIntolerance',
        R4.mapAllergyIntoleranceToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(cd, db, 'Encounter', R4.mapEncounterToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'CareTeam', R4.mapCareTeamToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'Goal', R4.mapGoalToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'Coverage', R4.mapCoverageToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(cd, db, 'Device', R4.mapDeviceToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(
        cd,
        db,
        'ServiceRequest',
        R4.mapServiceRequestToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(cd, db, 'Specimen', R4.mapSpecimenToClinicalDocument, {
        patient,
      }),
      syncFHIRResource(
        cd,
        db,
        'QuestionnaireResponse',
        R4.mapQuestionnaireResponseToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        cd,
        db,
        'RelatedPerson',
        R4.mapRelatedPersonToClinicalDocument,
        { patient },
      ),
      syncDocumentReferences(cd, db, { patient }),
    ]);
  },
};

async function syncDocumentReferences(
  connectionDocument: NextGenConnectionDocument,
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
                date: attachment.creation || docRefItem.metadata?.date,
                display_name: docRefItem.metadata?.display_name,
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
  cd: NextGenConnectionDocument,
): Promise<{ contentType: string | null; raw: string | Blob | undefined }> {
  try {
    const baseUrl = cd.location as string;
    const isRelativeUrl =
      !url.startsWith('http://') && !url.startsWith('https://');
    const fullUrl = isRelativeUrl ? resolveFhirUrl(baseUrl, url) : url;

    const isBinaryResource = /\/Binary\//.test(`/${fullUrl}`);
    const acceptHeader = isBinaryResource ? 'application/json' : '*/*';

    const sameOrigin = new URL(fullUrl).origin === new URL(baseUrl).origin;

    const res = await fetch(fullUrl, {
      headers: {
        ...(sameOrigin
          ? { Authorization: `Bearer ${cd.access_token}` }
          : undefined),
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
      contentType?.includes('application/json+fhir') ||
      (isBinaryResource && contentType?.includes('application/json'))
    ) {
      const binaryResource = await res.json();
      if (binaryResource.data) {
        const actualContentType =
          binaryResource.contentType || 'application/octet-stream';

        if (
          actualContentType === 'application/xml' ||
          actualContentType.includes('text')
        ) {
          raw = atob(binaryResource.data);
        } else {
          raw = binaryResource.data;
        }

        return { contentType: actualContentType, raw };
      }
    } else if (
      contentType?.includes('application/xml') ||
      contentType?.includes('text')
    ) {
      raw = await res.text();
    } else if (contentType) {
      raw = await res.blob();
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
): Promise<string | null> {
  try {
    const url = resolveFhirUrl(fhirBaseUrl, `Patient/${patientId}`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return null;
    }
    const patient = await response.json();
    return patient.managingOrganization?.display || null;
  } catch (e) {
    return null;
  }
}

export async function saveConnectionToDb({
  tokens,
  db,
  user,
}: {
  tokens: NextGenTokenSet;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
}) {
  const fhirBaseUrl = NEXTGEN_CONSTANTS.FHIR_BASE_URL;

  const existing = await findConnectionByTenant(
    db,
    user.id,
    'nextgen',
    tokens.patientId,
    fhirBaseUrl,
  );

  const organizationName = await fetchOrganizationName(
    tokens.accessToken,
    fhirBaseUrl,
    tokens.patientId,
  );

  if (existing) {
    const updateData: Partial<NextGenConnectionDocument> = {
      access_token: tokens.accessToken,
      expires_at: tokens.expiresAt,
      scope: tokens.scope,
      last_sync_was_error: false,
    };

    if (organizationName) {
      updateData.name = organizationName;
    }

    if (tokens.refreshToken) {
      updateData.refresh_token = tokens.refreshToken;
    }

    await updateConnection(db, user.id, existing.id, updateData);
  } else {
    const dbentry: CreateNextGenConnectionDocument = {
      id: uuid4(),
      user_id: user.id,
      source: 'nextgen',
      location: fhirBaseUrl,
      name: organizationName ?? 'NextGen Enterprise',
      access_token: tokens.accessToken,
      expires_at: tokens.expiresAt,
      scope: tokens.scope,
      refresh_token: tokens.refreshToken,
      patient: tokens.patientId,
      tenant_id: tokens.patientId,
      fhir_version: 'R4',
      auth_uri: NEXTGEN_CONSTANTS.AUTH_URL,
      token_uri: NEXTGEN_CONSTANTS.TOKEN_URL,
    };
    await createConnection(db, dbentry as NextGenConnectionDocument);
  }
}

export async function refreshNextGenConnectionTokenIfNeeded(
  config: AppConfig,
  connectionDocument: RxDocument<AnyConnectionDocument>,
  db: RxDatabase<DatabaseCollections>,
) {
  const currentTokens: NextGenTokenSet = {
    accessToken: connectionDocument.get('access_token'),
    expiresAt: connectionDocument.get('expires_at'),
    refreshToken: connectionDocument.get('refresh_token'),
    scope: connectionDocument.get('scope'),
    patientId: connectionDocument.get('patient'),
    raw: {},
  };

  if (isTokenExpired(currentTokens)) {
    const refreshToken = connectionDocument.get('refresh_token');
    if (!refreshToken) {
      throw new Error('Login expired - login required in order to sync data');
    }

    try {
      const userId = connectionDocument.get('user_id');
      const patientId = connectionDocument.get('patient');

      if (!patientId) {
        throw new Error('Connection missing patient ID — please reconnect');
      }

      const userObject = await findUserById(db, userId);

      if (!userObject) {
        throw new Error(`User not found: ${userId}`);
      }

      if (!config.NEXTGEN_CLIENT_ID || !config.PUBLIC_URL) {
        throw new Error('NextGen OAuth configuration is incomplete');
      }

      const oauthConfig = buildNextGenOAuthConfig({
        clientId: config.NEXTGEN_CLIENT_ID,
        publicUrl: config.PUBLIC_URL,
        redirectPath: Routes.NextGenCallback,
      });

      const client = createNextGenClient(config.PUBLIC_URL);
      const newTokens = await client.refresh(currentTokens, oauthConfig);

      return await saveConnectionToDb({
        tokens: newTokens,
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
