/**
 * Professional 20.1 SANDBOX FollowMyHealth
 * Patient Access
 * Property                   Value
 * FHIR Base Url              https://fhir.fhirpoint.open.allscripts.com/fhirroute/open/CustProProdSand201SMART
 * OAuth Authorization URL    https://open.allscripts.com/fhirroute/fmhpatientauth/0cd760ae-6ec5-4137-bf26-4269636b94ef/connect/authorize
 * OAuth Token URL            https://open.allscripts.com/fhirroute/fmhpatientauth/0cd760ae-6ec5-4137-bf26-4269636b94ef/connect/token
 * OAuth Scope                launch user/*.read
 * Patient Username           donna.dobson_prounityfhir (Patient id is 19)
 * Patient Password           Allscripts#1
 */

/**
 * TouchWorks 20.0 SANDBOX Allscripts Connect
 * Patient Access
 * Property                   Value
 * FHIR Base Url              https://tw181unityfhir.open.allscripts.com/open
 * OAuth Authorization URL    https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/authorize
 * OAuth Token URL            https://open.allscripts.com/fhirroute/patientauth/e75746a4-7f05-4b95-9ff5-44082c988959/connect/token
 * OAuth Scope                launch user/*.read
 * Patient Username           allison.allscripts@tw181unityfhir.edu (Patient id is 19)
 * Patient Password           Allscripts#1
 */

import * as DSTU2 from './DSTU2';
import {
  CreateVeradigmConnectionDocument,
  VeradigmConnectionDocument,
} from '../../models/connection-document/ConnectionDocument.type';
import { FhirResource, BundleEntry, Bundle, DocumentReference } from 'fhir/r2';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { CreateClinicalDocument } from '../../models/clinical-document/ClinicalDocument.type';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import {
  extractVeradigmPatientId,
  type VeradigmTokenSet,
} from '@mere/fhir-oauth';
import { getConnectionCardByUrl } from './getConnectionCardByUrl';
import {
  createConnection,
  updateConnection,
} from '../../repositories/ConnectionRepository';
import uuid4 from '../../shared/utils/UUIDUtils';
import { ResourceMapper, VendorSync, mapSearchedResources } from './sync';

export {
  createVeradigmClient,
  buildVeradigmOAuthConfig,
  VERADIGM_DEFAULT_SCOPES,
  type VeradigmClient,
  type VeradigmTokenSet,
  type VeradigmOAuthConfigOptions,
} from '@mere/fhir-oauth';
import {
  bulkUpsertDocuments,
  createDocument,
  documentExistsByMetadataId,
  findDocumentsByResourceType,
} from '../../repositories/ClinicalDocumentRepository';

export enum VeradigmLocalStorageKeys {
  VERADIGM_BASE_URL = 'veradigmBaseUrl',
  VERADIGM_AUTH_URL = 'veradigmAuthUrl',
  VERADIGM_TOKEN_URL = 'veradigmTokenUrl',
  VERADIGM_NAME = 'veradigmName',
  VERADIGM_ID = 'veradigmId',
}

export async function saveConnectionToDb({
  tokens,
  veradigmBaseUrl,
  veradigmId,
  db,
  user,
  name,
  auth_uri,
  token_uri,
}: {
  tokens: VeradigmTokenSet;
  veradigmBaseUrl: string;
  veradigmId: string;
  db: RxDatabase<DatabaseCollections>;
  user: UserDocument;
  name: string;
  auth_uri: string;
  token_uri: string;
}) {
  const doc = await getConnectionCardByUrl<VeradigmConnectionDocument>(
    veradigmBaseUrl,
    db,
    user.id,
  );
  return new Promise((resolve, reject) => {
    if (tokens.accessToken && user.id) {
      if (doc) {
        updateConnection(db, user.id, doc.id, {
          access_token: tokens.accessToken,
          expires_at: tokens.expiresAt,
          id_token: tokens.idToken,
          last_sync_was_error: false,
        })
          .then(() => {
            resolve(true);
          })
          .catch((e) => {
            console.error(e);
            reject(new Error('Error updating connection'));
          });
      } else {
        const dbentry: Omit<CreateVeradigmConnectionDocument, 'patient'> = {
          id: uuid4(),
          user_id: user.id,
          source: 'veradigm',
          location: veradigmBaseUrl,
          access_token: tokens.accessToken,
          expires_at: tokens.expiresAt,
          id_token: tokens.idToken,
          name,
          auth_uri,
          token_uri,
          tenant_id: veradigmId,
        };
        try {
          createConnection(db, dbentry as CreateVeradigmConnectionDocument)
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

async function getFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  fhirResourceUrl: string,
  params?: Record<string, string>,
): Promise<BundleEntry<T>[]> {
  const defaultUrl = params
    ? `${baseUrl}${fhirResourceUrl}?${new URLSearchParams(params)}`
    : `${baseUrl}${fhirResourceUrl}`;

  let allEntries: BundleEntry<T>[] = [];
  let nextUrl: string | undefined = defaultUrl;

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
    nextUrl = nextLink?.url;
  }

  return allEntries;
}

async function syncFHIRResource<T extends FhirResource>(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  fhirResourceUrl: string,
  mapper: ResourceMapper<BundleEntry<T>, VeradigmConnectionDocument>,
  params?: Record<string, string>,
) {
  const resc = await getFHIRResource<T>(
    baseUrl,
    connectionDocument,
    fhirResourceUrl,
    params,
  );

  return bulkUpsertDocuments(
    db,
    mapSearchedResources(resc, fhirResourceUrl, mapper, connectionDocument),
  );
}

export const sync: VendorSync = {
  refreshToken: null,
  syncAllRecords: ({ baseUrl, connection, db }) => {
    const cd =
      connection.toMutableJSON() as unknown as VeradigmConnectionDocument;
    const patient = extractVeradigmPatientId(cd.access_token);
    return Promise.allSettled([
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Procedure',
        DSTU2.mapProcedureToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Patient',
        DSTU2.mapPatientToClinicalDocument,
        { _id: patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Observation',
        DSTU2.mapObservationToClinicalDocument,
        { patient, category: 'laboratory' },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'DiagnosticReport',
        DSTU2.mapDiagnosticReportToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'MedicationStatement',
        DSTU2.mapMedicationStatementToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Immunization',
        DSTU2.mapImmunizationToClinicalDocument,
        { patient },
      ),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'Condition',
        DSTU2.mapConditionToClinicalDocument,
        { patient },
      ),
      syncDocumentReferences(baseUrl, cd, db, { patient }),
      syncFHIRResource(
        baseUrl,
        cd,
        db,
        'AllergyIntolerance',
        DSTU2.mapAllergyIntoleranceToClinicalDocument,
        { patient },
      ),
    ]);
  },
};

async function syncDocumentReferences(
  baseUrl: string,
  connectionDocument: VeradigmConnectionDocument,
  db: RxDatabase<DatabaseCollections>,
  params: Record<string, string>,
) {
  // Sync document references and return them
  await syncFHIRResource<DocumentReference>(
    baseUrl,
    connectionDocument,
    db,
    'DocumentReference',
    DSTU2.mapDocumentReferenceToClinicalDocument,
    params,
  );

  // format all the document references
  const docRefItems = await findDocumentsByResourceType<
    BundleEntry<DocumentReference>
  >(db, connectionDocument.user_id, connectionDocument.id, 'documentreference');
  // for each docref, get attachments and sync them
  const cdsmap = docRefItems.map(async (docRefItem) => {
    const attachments = (
      docRefItem.data_record.raw as BundleEntry<DocumentReference>
    ).resource?.content.map((a) => a.attachment);
    if (attachments) {
      for (const attachment of attachments) {
        const attachmentUrl = attachment?.url;
        if (attachmentUrl) {
          const exists = await documentExistsByMetadataId(
            db,
            connectionDocument.user_id,
            docRefItem.connection_record_id,
            attachmentUrl,
          );
          if (!exists) {
            console.log('Syncing attachment: ' + attachmentUrl);
            // attachment does not exist, sync it
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
                  format: 'FHIR.DSTU2',
                  content_type: contentType,
                  resource_type: 'documentreference_attachment',
                  version_history: [],
                },
                metadata: {
                  id: attachmentUrl,
                  date: attachment?.creation || docRefItem.metadata?.date,
                  display_name: docRefItem.metadata?.display_name,
                },
              };

              await createDocument(db, cd);
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
  cd: VeradigmConnectionDocument,
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
