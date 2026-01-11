# PDF Upload Feature Implementation Plan

## Overview

This plan addresses [Issue #221](https://github.com/cfu288/mere-medical/issues/221) - adding manual data input capability, specifically the ability to upload PDF documents and optionally link them to existing medical records.

## Requirements

1. Users can upload PDF documents (future: DICOM and other large files)
2. At upload, user provides: **display name** and **effective date** (document date)
3. Uploaded PDFs appear as **independent items** on the timeline, sorted by effective date
4. From existing timeline cards, users can **link uploaded documents** via search
5. One clinical document can link to multiple uploaded documents
6. One uploaded document can be linked from multiple clinical documents

---

## Architecture Decisions

### OPFS for File Storage

Store uploaded files in **OPFS (Origin Private File System)** rather than base64 in IndexedDB.

**Rationale**:
1. Large file support (DICOM files can be hundreds of MB)
2. No 33% base64 encoding overhead
3. Large files don't impact RxDB query performance
4. Streaming support for memory efficiency

**Trade-offs**:
1. Encryption must be handled separately (not automatic like SylvieJS)
2. Export/import requires custom logic to include OPFS files
3. Must keep IndexedDB refs and OPFS files in sync

### Discriminated Union for Document Source

Replace `connection_record_id` with a discriminated union `source` field that explicitly models document provenance.

**Rationale**:
1. **Semantic clarity** - `source.type` explicitly says what kind of document this is
2. **Type safety** - TypeScript enforces handling both cases at compile time
3. **No hidden filtering** - No "hide the pseudo-connection" logic scattered in UI
4. **No sentinel values** - No magic `source: 'user_upload'` string
5. **Extensible** - Easy to add future source types (e.g., `import`, `manual_entry`)
6. **Clean separation** - Source-specific data stays with the source, FHIR data stays in `data_record`

**Trade-offs**:
1. Schema migration to transform `connection_record_id` to `source` object
2. ~30 files need updates (mechanical, TypeScript-enforced)
3. Slightly more verbose queries (`source.connection_record_id` vs `connection_record_id`)

### Embedded Array for Links

Store links as an **embedded array** (`linked_document_ids`) on uploaded clinical documents.

**Rationale**:
1. NoSQL-idiomatic pattern
2. RxDB doesn't support atomic transactions across collections
3. Deleting an upload removes all its links automatically

**Note on Array Queries**: RxDB removed support for array field indexes in v12.0.0. Queries on `linked_document_ids` will perform full collection scans. This is acceptable given expected data volumes.

---

## Data Model

### Source Types (Discriminated Union)

```typescript
// apps/web/src/models/clinical-document/ClinicalDocument.type.ts

// ============ Source Types ============

/**
 * Document synced from an external provider (Epic, Cerner, etc.)
 * The connection record contains provider details, auth tokens, etc.
 */
interface ConnectionSource {
  type: 'connection';
  connection_record_id: string;
}

/**
 * Raw file uploaded by user, stored in OPFS.
 * File metadata lives here, not in data_record.
 */
interface FileUploadSource {
  type: 'file_upload';
  file: {
    opfs_path: string;
    name: string;
    content_type: string;  // e.g., 'application/pdf'
  };
}

/**
 * Future: Parsed from external format (CCDA, Blue Button, etc.)
 */
interface ImportSource {
  type: 'import';
  format: 'ccda' | 'fhir_bundle' | 'blue_button';
  imported_at: string;
}

/**
 * Future: Manually entered by user (e.g., typed notes)
 */
interface ManualEntrySource {
  type: 'manual_entry';
}

// The union - extend by adding new source interfaces
export type DocumentSource =
  | ConnectionSource
  | FileUploadSource;
  // | ImportSource      // Uncomment when implemented
  // | ManualEntrySource // Uncomment when implemented

// ============ Type Guards ============

export function isConnectionSource(source: DocumentSource): source is ConnectionSource {
  return source.type === 'connection';
}

export function isFileUploadSource(source: DocumentSource): source is FileUploadSource {
  return source.type === 'file_upload';
}

// ============ Helpers ============

export function getConnectionId(doc: ClinicalDocument): string | null {
  return isConnectionSource(doc.source) ? doc.source.connection_record_id : null;
}

export function getFilePath(doc: ClinicalDocument): string | null {
  return isFileUploadSource(doc.source) ? doc.source.file.opfs_path : null;
}

export function getMimeType(doc: ClinicalDocument): string | null {
  return isFileUploadSource(doc.source) ? doc.source.file.content_type : null;
}
```

### ClinicalDocument Interface

```typescript
// apps/web/src/models/clinical-document/ClinicalDocument.type.ts

// Resource types remain pure FHIR - no 'uploaded_*' types
export type ClinicalDocumentResourceType =
  | 'immunization'
  | 'condition'
  | 'procedure'
  | 'observation'
  | 'document_reference'
  | 'diagnostic_report'
  // ... all existing FHIR types, unchanged
  ;

export interface ClinicalDocument<T = unknown> {
  id: string;
  user_id: string;

  // Discriminated union replaces connection_record_id
  source: DocumentSource;

  // Common metadata for all document types
  metadata: {
    date: string;
    display_name: string;
  };

  // FHIR data - only present for connection sources
  // For file_upload sources, this is undefined
  data_record?: {
    resource_type: ClinicalDocumentResourceType;
    raw: T;
    format?: string;
    content_type?: string;
  };

  // For uploaded documents: links to other clinical documents
  linked_document_ids?: string[];
}
```

### RxDB Schema (JSON Schema)

```typescript
// apps/web/src/models/clinical-document/ClinicalDocument.schema.ts

export const ClinicalDocumentSchema: RxJsonSchema<ClinicalDocument> = {
  version: NEXT_VERSION,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 128 },
    user_id: { type: 'string' },

    // Discriminated union using oneOf
    source: {
      type: 'object',
      oneOf: [
        {
          properties: {
            type: { type: 'string', enum: ['connection'] },
            connection_record_id: { type: 'string' },
          },
          required: ['type', 'connection_record_id'],
        },
        {
          properties: {
            type: { type: 'string', enum: ['file_upload'] },
            file: {
              type: 'object',
              properties: {
                opfs_path: { type: 'string' },
                name: { type: 'string' },
                content_type: { type: 'string' },
              },
              required: ['opfs_path', 'name', 'content_type'],
            },
          },
          required: ['type', 'file'],
        },
      ],
    },

    metadata: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        display_name: { type: 'string' },
      },
    },

    data_record: {
      type: 'object',
      properties: {
        resource_type: { type: 'string' },
        raw: { type: 'object' },
        format: { type: 'string' },
        content_type: { type: 'string' },
      },
    },

    linked_document_ids: {
      type: 'array',
      items: { type: 'string' },
      default: [],
    },
  },
  required: ['id', 'user_id', 'source', 'metadata'],
  indexes: ['user_id', 'source.type', 'source.connection_record_id', 'metadata.date'],
};
```

### Migration

```typescript
// apps/web/src/models/clinical-document/ClinicalDocument.migration.ts

export const ClinicalDocumentMigrations: MigrationStrategies = {
  // ... existing migrations ...

  // Migration: connection_record_id -> source discriminated union
  [NEXT_VERSION]: (oldDoc) => {
    return {
      ...oldDoc,
      // Transform connection_record_id to source object
      source: {
        type: 'connection',
        connection_record_id: oldDoc.connection_record_id,
      },
      // Remove old field
      connection_record_id: undefined,
      // Add new field with default
      linked_document_ids: oldDoc.linked_document_ids || [],
    };
  },
};
```

---

## Normalized Timeline Record

All timeline items (clinical and uploaded) are normalized to a common shape for rendering.

### TimelineRecord Type

```typescript
// apps/web/src/features/timeline/types/TimelineRecord.ts

import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
  isFileUploadSource,
  isConnectionSource,
} from '../../../models/clinical-document/ClinicalDocument.type';

export interface TimelineRecord {
  // Identity
  id: string;

  // Display fields (unified)
  date: string;
  displayName: string;

  // Source type determines rendering
  sourceType: 'connection' | 'file_upload';

  // For connection sources
  resourceType?: ClinicalDocumentResourceType;
  connectionId?: string;

  // For file_upload sources
  filePath?: string;
  fileName?: string;
  mimeType?: string;

  // Links (for uploaded docs)
  linkedDocumentIds?: string[];

  // Original document for detail views
  _original: ClinicalDocument;
}

// Adapter: ClinicalDocument -> TimelineRecord
export function toTimelineRecord(doc: ClinicalDocument): TimelineRecord {
  const base = {
    id: doc.id,
    date: doc.metadata.date,
    displayName: doc.metadata.display_name,
    linkedDocumentIds: doc.linked_document_ids,
    _original: doc,
  };

  if (isFileUploadSource(doc.source)) {
    return {
      ...base,
      sourceType: 'file_upload',
      filePath: doc.source.file.opfs_path,
      fileName: doc.source.file.name,
      mimeType: doc.source.file.content_type,
    };
  }

  // Connection source
  return {
    ...base,
    sourceType: 'connection',
    resourceType: doc.data_record?.resource_type,
    connectionId: doc.source.connection_record_id,
  };
}

// Type guards for TimelineRecord
export function isUploadedRecord(record: TimelineRecord): boolean {
  return record.sourceType === 'file_upload';
}

export function isConnectionRecord(record: TimelineRecord): boolean {
  return record.sourceType === 'connection';
}
```

### Card Registry

```typescript
// apps/web/src/features/timeline/components/cardRegistry.tsx

import { ClinicalDocumentResourceType } from '../../../models/clinical-document/ClinicalDocument.type';
import { TimelineRecord, isUploadedRecord } from '../types/TimelineRecord';

// Import all card components
import { ImmunizationCard } from './cards/ImmunizationCard';
import { ConditionCard } from './cards/ConditionCard';
import { ProcedureCard } from './cards/ProcedureCard';
import { ObservationCard } from './cards/ObservationCard';
import { MedicationCard } from './cards/MedicationCard';
import { UploadedDocumentCard } from './cards/UploadedDocumentCard';
// ... other imports

type CardComponent = React.ComponentType<{ record: TimelineRecord }>;

// Registry for FHIR resource types (connection sources only)
const fhirCardRegistry: Partial<Record<ClinicalDocumentResourceType, CardComponent>> = {
  immunization: ImmunizationCard,
  condition: ConditionCard,
  procedure: ProcedureCard,
  observation: ObservationCard,
  medicationstatement: MedicationCard,
  medicationrequest: MedicationCard,
  // ... other clinical types
};

/**
 * Get the appropriate card component for a timeline record.
 * Uses source type first (file_upload -> UploadedDocumentCard),
 * then falls back to FHIR resource type registry.
 */
export function getCardForRecord(record: TimelineRecord): CardComponent | null {
  // File uploads always use UploadedDocumentCard
  if (isUploadedRecord(record)) {
    return UploadedDocumentCard;
  }

  // Connection sources use FHIR resource type registry
  if (record.resourceType) {
    return fhirCardRegistry[record.resourceType] || null;
  }

  return null;
}

// Fallback card for unknown types
export function UnknownRecordCard({ record }: { record: TimelineRecord }) {
  return (
    <div className="p-4 bg-gray-50 rounded">
      <span className="text-gray-500">
        Unknown: {record.sourceType === 'file_upload' ? record.mimeType : record.resourceType}
      </span>
    </div>
  );
}
```

---

## Query Patterns and Performance

### Expected Query Patterns

With the discriminated union approach, queries use `source.type` to distinguish document origins:

| Query | Use Case | Selector | Performance |
|-------|----------|----------|-------------|
| Get timeline sorted by date | Timeline display | `{ user_id, 'metadata.date': { $exists: true } }` | ✅ Good |
| Get all file uploads | Uploads list | `{ 'source.type': 'file_upload' }` | ✅ Good |
| Get uploads by mime type | Filter PDFs | `{ 'source.type': 'file_upload', 'source.file.content_type': 'application/pdf' }` | ✅ Good |
| Get docs by connection | Connection detail | `{ 'source.type': 'connection', 'source.connection_record_id': id }` | ✅ Good |
| Get linked docs FROM upload | View upload detail | Direct ID lookup via `linked_document_ids` | ✅ Good |
| Get uploads linked TO clinical doc | View clinical doc detail | **Full scan on file_upload docs** | ⚠️ O(n) |

### Reverse Lookup Performance Trade-off

The query "find uploads linked to a clinical document" requires filtering file_upload documents by `linked_document_ids`. This is acceptable because:

1. **Expected volume**: Most users will have < 100 uploaded documents
2. **Query frequency**: Only triggered when viewing a clinical document detail
3. **Alternative complexity**: Bidirectional links require manual sync

---

## Repository: `ClinicalDocumentRepository`

Extend the existing `ClinicalDocumentRepository` with upload-specific functions. Uses discriminated union `source.type` for queries.

```typescript
// Update apps/web/src/repositories/ClinicalDocumentRepository.ts

import { RxDatabase, RxDocument } from 'rxdb';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import {
  ClinicalDocument,
  isFileUploadSource,
} from '../models/clinical-document/ClinicalDocument.type';

// ============ Existing Functions (updated for discriminated union) ============

export async function deleteDocumentsByConnectionId(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'source.type': 'connection',
        'source.connection_record_id': connectionId,
      },
    })
    .remove();
}

// ============ Upload-Specific Query Functions ============

/**
 * Find all file uploads for a user.
 */
export async function findAllUploads(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<ClinicalDocument[]> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'source.type': 'file_upload',
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .exec();
  return docs.map((doc) => doc.toJSON() as ClinicalDocument);
}

/**
 * Find upload by ID with user access check.
 */
export async function findUploadById(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  id: string,
): Promise<ClinicalDocument | null> {
  const doc = await db.clinical_documents
    .findOne({ selector: { id } })
    .exec();

  if (!doc) return null;

  if (doc.user_id !== userId) {
    throw new Error(`Access denied: Document ${id} belongs to different user`);
  }

  if (!isFileUploadSource(doc.source)) {
    throw new Error(`Document ${id} is not a file upload`);
  }

  return doc.toJSON() as ClinicalDocument;
}

/**
 * Find uploads linked to a specific clinical document.
 * Filters uploaded docs where linked_document_ids contains the target ID.
 */
export async function findUploadsLinkedTo(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  clinicalDocId: string,
): Promise<ClinicalDocument[]> {
  const allUploads = await findAllUploads(db, userId);

  return allUploads.filter((doc) =>
    doc.linked_document_ids?.includes(clinicalDocId)
  );
}

/**
 * Find clinical documents by IDs, scoped to user.
 */
export async function findByIds(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  ids: string[],
): Promise<ClinicalDocument[]> {
  if (!ids.length) return [];

  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        id: { $in: ids },
      },
    })
    .exec();

  return docs.map((doc) => doc.toJSON() as ClinicalDocument);
}

// ============ Upload-Specific Command Functions ============

/**
 * Insert a file upload document.
 */
export async function insertUpload(
  db: RxDatabase<DatabaseCollections>,
  data: ClinicalDocument,
): Promise<RxDocument<ClinicalDocument>> {
  if (!data.user_id) {
    throw new Error('Cannot create document without user_id');
  }
  if (!isFileUploadSource(data.source)) {
    throw new Error('Use insertUpload only for file_upload documents');
  }
  return db.clinical_documents.insert(data);
}

/**
 * Add a link from an uploaded document to a clinical document.
 */
export async function addLink(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  uploadId: string,
  clinicalDocId: string,
): Promise<void> {
  const doc = await db.clinical_documents
    .findOne({ selector: { id: uploadId } })
    .exec();

  if (!doc) {
    throw new Error(`Document not found: ${uploadId}`);
  }

  if (doc.user_id !== userId) {
    throw new Error(`Access denied: Document ${uploadId} belongs to different user`);
  }

  const currentLinks = doc.linked_document_ids || [];
  if (currentLinks.includes(clinicalDocId)) return;

  await doc.update({
    $set: { linked_document_ids: [...currentLinks, clinicalDocId] },
  });
}

/**
 * Remove a link from an uploaded document.
 */
export async function removeLink(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  uploadId: string,
  clinicalDocId: string,
): Promise<void> {
  const doc = await db.clinical_documents
    .findOne({ selector: { id: uploadId } })
    .exec();

  if (!doc || doc.user_id !== userId) return;

  const currentLinks = doc.linked_document_ids || [];
  await doc.update({
    $set: {
      linked_document_ids: currentLinks.filter((id) => id !== clinicalDocId),
    },
  });
}

/**
 * Remove a file upload and return its OPFS path for cleanup.
 */
export async function removeUpload(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  uploadId: string,
): Promise<string | null> {
  const doc = await db.clinical_documents
    .findOne({ selector: { id: uploadId } })
    .exec();

  if (!doc || doc.user_id !== userId) return null;
  if (!isFileUploadSource(doc.source)) return null;

  const opfsPath = doc.source.file.opfs_path;
  await doc.remove();
  return opfsPath;
}

// ============ Reactive Functions ============

/**
 * Watch all file uploads for a user.
 */
export function watchAllUploads(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Observable<ClinicalDocument[]> {
  return db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'source.type': 'file_upload',
      },
      sort: [{ 'metadata.date': 'desc' }],
    })
    .$.pipe(map((docs) => docs.map((doc) => doc.toJSON() as ClinicalDocument)));
}
```

---

## Query Hooks

Hooks use `ClinicalDocumentRepository` for all data access.

```typescript
// apps/web/src/features/upload/hooks/useUploadedDocuments.tsx

import { useCallback, useEffect, useState } from 'react';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import * as clinicalDocRepo from '../../../repositories/ClinicalDocumentRepository';

type UploadsByDate = Record<string, ClinicalDocument[]>;

export type UploadQueryStatus = 'idle' | 'loading' | 'success' | 'error';

function groupByDate(uploads: ClinicalDocument[]): UploadsByDate {
  const grouped: UploadsByDate = {};
  for (const upload of uploads) {
    const dateKey = upload.metadata?.date
      ? upload.metadata.date.split('T')[0]
      : '1970-01-01';

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(upload);
  }
  return grouped;
}

/**
 * Hook for querying user uploaded documents.
 */
export function useUploadedDocuments(): {
  data: UploadsByDate;
  status: UploadQueryStatus;
  refetch: () => void;
} {
  const db = useRxDb();
  const user = useUser();
  const [data, setData] = useState<UploadsByDate>({});
  const [status, setStatus] = useState<UploadQueryStatus>('idle');

  const fetchUploads = useCallback(async () => {
    setStatus('loading');
    try {
      const uploads = await clinicalDocRepo.findAllUploads(db, user.id);
      setData(groupByDate(uploads));
      setStatus('success');
    } catch (error) {
      console.error('Failed to fetch uploads:', error);
      setStatus('error');
    }
  }, [db, user.id]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  return { data, status, refetch: fetchUploads };
}

/**
 * Get uploads linked to a specific clinical document.
 */
export function useLinkedUploads(clinicalDocId: string | undefined): {
  uploads: ClinicalDocument[];
  status: UploadQueryStatus;
} {
  const db = useRxDb();
  const user = useUser();
  const [uploads, setUploads] = useState<ClinicalDocument[]>([]);
  const [status, setStatus] = useState<UploadQueryStatus>('idle');

  useEffect(() => {
    if (!clinicalDocId) {
      setUploads([]);
      return;
    }

    const fetchLinked = async () => {
      setStatus('loading');
      try {
        const linked = await clinicalDocRepo.findUploadsLinkedTo(db, user.id, clinicalDocId);
        setUploads(linked);
        setStatus('success');
      } catch (error) {
        console.error('Failed to fetch linked uploads:', error);
        setStatus('error');
      }
    };

    fetchLinked();
  }, [db, user.id, clinicalDocId]);

  return { uploads, status };
}

/**
 * Get clinical documents linked FROM an uploaded document.
 */
export function useLinkedClinicalDocs(uploadedDoc: ClinicalDocument | undefined): {
  clinicalDocs: ClinicalDocument[];
  status: UploadQueryStatus;
} {
  const db = useRxDb();
  const user = useUser();
  const [clinicalDocs, setClinicalDocs] = useState<ClinicalDocument[]>([]);
  const [status, setStatus] = useState<UploadQueryStatus>('idle');

  useEffect(() => {
    if (!uploadedDoc?.linked_document_ids?.length) {
      setClinicalDocs([]);
      return;
    }

    const fetchLinked = async () => {
      setStatus('loading');
      try {
        const docs = await clinicalDocRepo.findByIds(
          db,
          user.id,
          uploadedDoc.linked_document_ids!
        );
        setClinicalDocs(docs);
        setStatus('success');
      } catch (error) {
        console.error('Failed to fetch linked clinical docs:', error);
        setStatus('error');
      }
    };

    fetchLinked();
  }, [db, user.id, uploadedDoc?.linked_document_ids]);

  return { clinicalDocs, status };
}
```

### Hook Usage Examples

```typescript
// Get all uploads grouped by date
function UploadTimeline() {
  const { data, status } = useUploadedDocuments();
  // data is Record<string, ClinicalDocument[]> grouped by date
}

// Clinical document detail: show linked uploads
function ClinicalDocDetail({ docId }: { docId: string }) {
  const { uploads, status } = useLinkedUploads(docId);
  // uploads is ClinicalDocument[] (uploaded docs linked to this clinical doc)
}

// Upload detail: show linked clinical documents
function UploadDetail({ upload }: { upload: ClinicalDocument }) {
  const { clinicalDocs, status } = useLinkedClinicalDocs(upload);
  // clinicalDocs is ClinicalDocument[] this upload links to
}
```

---

## Timeline Integration

With the discriminated union, the timeline uses a single query. Both connection and file_upload sources are included.

### Single Collection Query

```typescript
// apps/web/src/features/timeline/hooks/useTimelineRecords.ts

import { toTimelineRecord, TimelineRecord } from '../types/TimelineRecord';

export async function fetchTimelineRecords(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  options: { page: number; pageSize: number }
): Promise<TimelineRecord[]> {
  // Single query - both connection sources and file uploads
  // For connection sources, exclude non-timeline resource types
  // File uploads are always included (they don't have data_record.resource_type)
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'metadata.date': { $exists: true, $ne: '' },
        $or: [
          // File uploads - always show on timeline
          { 'source.type': 'file_upload' },
          // Connection sources - exclude certain resource types
          {
            'source.type': 'connection',
            'data_record.resource_type': {
              $nin: ['patient', 'careplan', 'allergyintolerance', 'documentreference_attachment', 'provenance'],
            },
          },
        ],
      },
      sort: [{ 'metadata.date': 'desc' }],
      skip: options.page * options.pageSize,
      limit: options.pageSize,
    })
    .exec();

  // Normalize all documents to TimelineRecord
  return docs.map((doc) => toTimelineRecord(doc.toJSON() as ClinicalDocument));
}
```

### Timeline Rendering with Card Registry

Using the card registry (defined earlier), rendering is simple:

```typescript
// apps/web/src/features/timeline/components/layout/TimelineItem.tsx

import { TimelineRecord } from '../../types/TimelineRecord';
import { getCardForRecord, UnknownRecordCard } from '../cardRegistry';

function TimelineItemComponent({ record }: { record: TimelineRecord }) {
  const CardComponent = getCardForRecord(record);

  if (!CardComponent) {
    return <UnknownRecordCard record={record} />;
  }

  return <CardComponent record={record} />;
}
```

### Date Grouping

Group normalized records by date:

```typescript
function groupTimelineByDate(records: TimelineRecord[]): Record<string, TimelineRecord[]> {
  const grouped: Record<string, TimelineRecord[]> = {};

  for (const record of records) {
    const dateKey = record.date ? record.date.split('T')[0] : '1970-01-01';

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(record);
  }

  return grouped;
}
```

---

## OPFS Service

```typescript
// apps/web/src/features/upload/services/opfsStorage.ts

const UPLOADS_DIR = 'uploads';

/**
 * Check if OPFS is supported in this browser
 */
export function checkOPFSSupport(): boolean {
  return typeof navigator?.storage?.getDirectory === 'function';
}

/**
 * Initialize OPFS directory structure
 */
export async function initOPFS(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(UPLOADS_DIR, { create: true });
}

/**
 * Save a file to OPFS
 */
export async function saveFileToOPFS(
  file: File,
  documentId: string
): Promise<string> {
  const uploadsDir = await initOPFS();
  const extension = file.name.includes('.')
    ? file.name.substring(file.name.lastIndexOf('.'))
    : '';
  const fileName = `${documentId}${extension}`;
  const opfsPath = `/${UPLOADS_DIR}/${fileName}`;

  const fileHandle = await uploadsDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();

  return opfsPath;
}

/**
 * Read a file from OPFS
 */
export async function readFileFromOPFS(opfsPath: string): Promise<File | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const pathParts = opfsPath.split('/').filter(Boolean);

    let currentDir = root;
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
    }

    const fileName = pathParts[pathParts.length - 1];
    const fileHandle = await currentDir.getFileHandle(fileName);
    return fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * Delete a file from OPFS
 */
export async function deleteFileFromOPFS(opfsPath: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const pathParts = opfsPath.split('/').filter(Boolean);

    let currentDir = root;
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(pathParts[i]);
    }

    const fileName = pathParts[pathParts.length - 1];
    await currentDir.removeEntry(fileName);
  } catch {
    // File may not exist, ignore
  }
}

/**
 * List all files in OPFS uploads directory
 */
export async function listOPFSFiles(): Promise<string[]> {
  try {
    const uploadsDir = await initOPFS();
    const files: string[] = [];
    for await (const entry of uploadsDir.values()) {
      if (entry.kind === 'file') {
        files.push(`/${UPLOADS_DIR}/${entry.name}`);
      }
    }
    return files;
  } catch {
    return [];
  }
}
```

---

## Upload Service

Orchestrates storage + repository. Uses discriminated union `source.type: 'file_upload'`. Injects `StorageAdapter` for testability.

```typescript
// apps/web/src/features/upload/services/uploadService.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import uuid4 from '../../../shared/utils/UUIDUtils';
import { StorageAdapter } from './storageAdapter';
import * as clinicalDocRepo from '../../../repositories/ClinicalDocumentRepository';

// Supported file types (by MIME type)
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  // Future: 'application/dicom',
  // Future: 'image/png', 'image/jpeg',
]);

export class UploadError extends Error {
  constructor(
    message: string,
    public code: 'UNSUPPORTED_BROWSER' | 'INVALID_TYPE' | 'STORAGE_ERROR'
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export async function uploadDocument(
  db: RxDatabase<DatabaseCollections>,
  storage: StorageAdapter,
  file: File,
  userId: string,
  displayName: string,
  documentDate: string
): Promise<ClinicalDocument> {
  // 1. Validate file type
  if (!SUPPORTED_MIME_TYPES.has(file.type)) {
    throw new UploadError(
      `File type "${file.type}" is not supported. Please upload a PDF file.`,
      'INVALID_TYPE'
    );
  }

  // 2. Generate ID and save to storage
  const id = uuid4();
  let opfsPath: string | null = null;

  try {
    opfsPath = await storage.save(file, id);

    // 3. Create clinical document with file_upload source
    const doc = await clinicalDocRepo.insertUpload(db, {
      id,
      user_id: userId,
      source: {
        type: 'file_upload',
        file: {
          opfs_path: opfsPath,
          name: file.name,
          content_type: file.type,
        },
      },
      metadata: {
        date: documentDate,
        display_name: displayName,
      },
      linked_document_ids: [],
    });

    return doc.toJSON() as ClinicalDocument;
  } catch (error) {
    // Cleanup storage if repository insert failed
    if (opfsPath) {
      await storage.delete(opfsPath);
    }
    throw new UploadError('Failed to save document. Please try again.', 'STORAGE_ERROR');
  }
}

export async function deleteUploadedDocument(
  db: RxDatabase<DatabaseCollections>,
  storage: StorageAdapter,
  userId: string,
  documentId: string
): Promise<void> {
  // Repository handles user check and returns opfs path for cleanup
  const opfsPath = await clinicalDocRepo.removeUpload(db, userId, documentId);

  if (opfsPath) {
    await storage.delete(opfsPath);
  }
}
```

---

## Export/Import Integration

### New Dependency

Add zip.js for client-side ZIP handling with streaming support:
```bash
npm install @zip.js/zip.js
```

### Export Format

**v1 (existing)**: `mere_export_2024-01-15.json` - RxDB JSON only

**v2 (new)**: `mere_export_2024-01-15.zip` containing:
```
mere_export_2024-01-15.zip
├── database.json          # RxDB export (same format as v1)
└── uploads/
    ├── {uuid1}.pdf
    ├── {uuid2}.pdf
    └── ...
```

### Import Compatibility

| File Type | Format | Supported |
|-----------|--------|-----------|
| `.json` | v1 (RxDB only) | Yes |
| `.zip` | v2 (RxDB + OPFS files) | Yes |

### Export Service

```typescript
// apps/web/src/features/upload/services/exportService.ts

import { BlobWriter, ZipWriter, BlobReader, TextReader } from '@zip.js/zip.js';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { readFileFromOPFS } from './opfsStorage';
import { isFileUploadSource } from '../../../models/clinical-document/ClinicalDocument.type';

/**
 * Check if File System Access API is supported (Chrome/Edge)
 */
function supportsFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window;
}

/**
 * Get file upload documents from clinical_documents collection.
 * Uses discriminated union: source.type === 'file_upload'
 */
async function getFileUploads(db: RxDatabase<DatabaseCollections>) {
  const docs = await db.clinical_documents
    .find({
      selector: {
        'source.type': 'file_upload',
      },
    })
    .exec();
  return docs.filter((d) => isFileUploadSource(d.source));
}

/**
 * Export with streaming to disk (Chrome/Edge) - handles 5GB+ exports
 */
export async function exportWithStreaming(
  db: RxDatabase<DatabaseCollections>
): Promise<void> {
  const fileName = `mere_export_${new Date().toISOString().split('T')[0]}.zip`;

  // Get a file handle from the user
  const fileHandle = await (window as any).showSaveFilePicker({
    suggestedName: fileName,
    types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
  });

  const writable = await fileHandle.createWritable();
  const zipWriter = new ZipWriter(writable);

  try {
    // 1. Export RxDB data as JSON
    const dbExport = await db.exportJSON();
    await zipWriter.add('database.json', new TextReader(JSON.stringify(dbExport, null, 2)));

    // 2. Stream OPFS files directly to ZIP
    const uploads = await getFileUploads(db);

    for (const upload of uploads) {
      if (!isFileUploadSource(upload.source)) continue;
      const opfsPath = upload.source.file.opfs_path;

      const file = await readFileFromOPFS(opfsPath);
      if (file) {
        const fileName = opfsPath.split('/').pop() || `${upload.id}.pdf`;
        await zipWriter.add(`uploads/${fileName}`, new BlobReader(file));
      }
    }

    await zipWriter.close();
  } catch (error) {
    await zipWriter.close();
    throw error;
  }
}

/**
 * Export to Blob (Firefox/Safari fallback) - memory limited
 */
export async function exportAsZip(
  db: RxDatabase<DatabaseCollections>
): Promise<Blob> {
  const blobWriter = new BlobWriter('application/zip');
  const zipWriter = new ZipWriter(blobWriter);

  // 1. Export RxDB data as JSON
  const dbExport = await db.exportJSON();
  await zipWriter.add('database.json', new TextReader(JSON.stringify(dbExport, null, 2)));

  // 2. Add OPFS files to uploads/ folder
  const uploads = await getFileUploads(db);

  for (const upload of uploads) {
    if (!isFileUploadSource(upload.source)) continue;
    const opfsPath = upload.source.file.opfs_path;

    const file = await readFileFromOPFS(opfsPath);
    if (file) {
      const fileName = opfsPath.split('/').pop() || `${upload.id}.pdf`;
      await zipWriter.add(`uploads/${fileName}`, new BlobReader(file));
    }
  }

  await zipWriter.close();
  return blobWriter.getData();
}

export { supportsFileSystemAccess };
```

### Import Service

```typescript
// apps/web/src/features/upload/services/importService.ts

import { BlobReader, ZipReader, TextWriter, BlobWriter } from '@zip.js/zip.js';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { databaseCollections } from '../../../app/providers/RxDbProvider';
import { saveFileToOPFS, checkOPFSSupport } from './opfsStorage';
import { isFileUploadSource } from '../../../models/clinical-document/ClinicalDocument.type';

/**
 * Detect import file type and route to appropriate handler
 */
export async function importBackup(
  file: File,
  db: RxDatabase<DatabaseCollections>
): Promise<string> {
  if (file.name.endsWith('.zip') || file.type === 'application/zip') {
    return importFromZip(file, db);
  } else {
    // v1 JSON import - use existing logic
    const jsonString = await file.text();
    return importFromJSON(jsonString, db);
  }
}

/**
 * Import from v2 ZIP format
 */
async function importFromZip(
  file: File,
  db: RxDatabase<DatabaseCollections>
): Promise<string> {
  const zipReader = new ZipReader(new BlobReader(file));
  const entries = await zipReader.getEntries();

  // 1. Extract and parse database.json
  const dbEntry = entries.find((e) => e.filename === 'database.json');
  if (!dbEntry || !dbEntry.getData) {
    await zipReader.close();
    throw new Error('Invalid backup: missing database.json');
  }

  const dbJsonString = await dbEntry.getData(new TextWriter());
  const dbData = JSON.parse(dbJsonString);

  // 2. Import RxDB data
  await Promise.all(Object.values(db.collections).map((col) => col?.remove()));
  await db.addCollections<DatabaseCollections>(databaseCollections);

  await db.importJSON(dbData);

  // 3. Restore OPFS files for file_upload documents
  let uploadCount = 0;
  if (checkOPFSSupport()) {
    // Query clinical_documents for file uploads (source.type === 'file_upload')
    const uploadDocs = await db.clinical_documents
      .find({
        selector: {
          'source.type': 'file_upload',
        },
      })
      .exec();

    const uploadEntries = entries.filter((e) => e.filename.startsWith('uploads/'));

    for (const doc of uploadDocs) {
      if (!isFileUploadSource(doc.source)) continue;

      const opfsPath = doc.source.file.opfs_path;
      const fileName = opfsPath.split('/').pop();
      if (!fileName) continue;

      const zipEntry = uploadEntries.find((e) => e.filename === `uploads/${fileName}`);
      if (zipEntry && zipEntry.getData) {
        const blob = await zipEntry.getData(new BlobWriter());
        const restoredFile = new File([blob], doc.source.file.name, {
          type: doc.source.file.content_type,
        });
        await saveFileToOPFS(restoredFile, doc.id);
        uploadCount++;
      }
    }
  }

  await zipReader.close();
  return `Successfully imported backup with ${uploadCount} uploaded files`;
}

/**
 * Import from v1 JSON format (backward compatible)
 */
async function importFromJSON(
  jsonString: string,
  db: RxDatabase<DatabaseCollections>
): Promise<string> {
  const dbData = JSON.parse(jsonString);

  await Promise.all(Object.values(db.collections).map((col) => col?.remove()));
  await db.addCollections<DatabaseCollections>(databaseCollections);

  await db.importJSON(dbData);

  return 'Successfully imported backup';
}
```

### Updated UserDataSettingsGroup.tsx

```typescript
// Modify apps/web/src/features/settings/components/UserDataSettingsGroup.tsx

import {
  exportAsZip,
  exportWithStreaming,
  supportsFileSystemAccess,
} from '../../upload/services/exportService';
import { importBackup } from '../../upload/services/importService';

// Export handler
export const exportData = async (
  db: RxDatabase<DatabaseCollections>,
  setFileDownloadLink: (blob: string) => void,
  notifyDispatch: NotificationDispatch,
) => {
  // Check for file uploads (source.type === 'file_upload')
  const uploads = await db.clinical_documents
    .find({
      selector: {
        'source.type': 'file_upload',
      },
    })
    .exec();

  if (uploads.length > 0) {
    // v2: Export as ZIP with uploaded files
    if (supportsFileSystemAccess()) {
      // Chrome/Edge: Stream directly to disk (handles 5GB+)
      await exportWithStreaming(db);
      notifyDispatch({
        type: 'set_notification',
        message: 'Export saved successfully',
        variant: 'success',
      });
      return null; // No blob URL - file was saved via picker
    } else {
      // Firefox/Safari: Load into memory (show warning for large exports)
      const totalSize = uploads.reduce((acc, u) => {
        // Estimate size - actual file size not stored
        return acc + 1; // Count files instead
      }, 0);

      if (totalSize > 50) {
        // More than 50 files - warn user
        notifyDispatch({
          type: 'set_notification',
          message: 'Large export may be slow. Consider using Chrome for better performance.',
          variant: 'warning',
        });
      }

      const zipBlob = await exportAsZip(db);
      const blobUrl = URL.createObjectURL(zipBlob);
      setFileDownloadLink(blobUrl);
      return blobUrl;
    }
  } else {
    // v1: Export as JSON only (no uploaded files)
    const dbExport = await db.exportJSON();
    const jsonData = JSON.stringify(dbExport);
    const blobUrl = URL.createObjectURL(
      new Blob([jsonData], { type: 'application/json' }),
    );
    setFileDownloadLink(blobUrl);
    return blobUrl;
  }
};

// Import handler - update handleImport to use importBackup
export const handleImport = async (
  fields: ImportFields,
  db: RxDatabase<DatabaseCollections>,
): Promise<string> => {
  const file = getFileFromFileList(fields.backup);
  if (!file || !(file instanceof File)) {
    throw new Error('Unable to parse file from file list');
  }

  return importBackup(file, db);
};
```

### Updated File Input

Update the import file input to accept both JSON and ZIP:

```tsx
<input
  type="file"
  accept="application/json,.json,application/zip,.zip"
  // ...
/>
```

### Download Filename

Update download link to use appropriate extension:

```tsx
<a
  download={`mere_export_${new Date().toISOString()}${hasUploads ? '.zip' : '.json'}`}
  href={fileDownloadLink}
>
  Download
</a>
```

---

## Form Validation

Uses existing pattern with `yup` and `react-hook-form` (matches `AddUserModal.tsx`).

```typescript
// apps/web/src/features/upload/components/uploadValidation.ts

import * as yup from 'yup';

export const uploadValidationSchema = yup.object({
  file: yup.mixed<FileList>().required('Please select a file'),
  displayName: yup.string().required('Display name is required'),
  documentDate: yup.date().required('Document date is required'),
});

export type UploadFormFields = yup.InferType<typeof uploadValidationSchema>;
```

---

## Upload Modal Component

Uses existing shared components: `Modal`, `getFileFromFileList()`, notification dispatch pattern.

```typescript
// apps/web/src/features/upload/components/UploadDocumentModal.tsx

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { SubmitHandler, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Modal } from '../../../shared/components/Modal';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useNotificationDispatch } from '../../../app/providers/NotificationProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { getFileFromFileList } from '../../../shared/utils/FileUtils';
import { uploadDocument, UploadError } from '../services/uploadService';
import { createOPFSAdapter } from '../services/storageAdapter';
import { uploadValidationSchema, UploadFormFields } from './uploadValidation';
import { ButtonLoadingSpinner } from '../../connections/components/ButtonLoadingSpinner';

interface UploadDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UploadDocumentModal({ open, onClose, onSuccess }: UploadDocumentModalProps) {
  const db = useRxDb();
  const user = useUser();
  const notifyDispatch = useNotificationDispatch();
  const [isUploading, setIsUploading] = useState(false);
  const storage = createOPFSAdapter();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<UploadFormFields>({
    resolver: yupResolver(uploadValidationSchema),
  });

  const selectedFile = getFileFromFileList(watch('file'));

  const onSubmit: SubmitHandler<UploadFormFields> = async (data) => {
    const file = getFileFromFileList(data.file);
    if (!file || !(file instanceof File)) return;

    setIsUploading(true);
    try {
      await uploadDocument(
        db,
        storage,
        file,
        user.id,
        data.displayName,
        new Date(data.documentDate).toISOString()
      );

      notifyDispatch({
        type: 'set_notification',
        message: 'Document uploaded successfully',
        variant: 'success',
      });

      reset();
      onClose();
      onSuccess?.();
    } catch (error) {
      const message = error instanceof UploadError
        ? error.message
        : 'Failed to upload document. Please try again.';

      notifyDispatch({
        type: 'set_notification',
        message,
        variant: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal open={open} setOpen={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-primary-700 px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-medium text-white">
              Upload Document
            </Dialog.Title>
            <button
              type="button"
              className="rounded-md text-white hover:text-white focus:outline-none"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-800">
              PDF File
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              {...register('file')}
            />
            {errors.file && (
              <p className="mt-1 text-sm text-red-500">{errors.file.message}</p>
            )}
            {selectedFile instanceof File && (
              <p className="mt-1 text-sm text-gray-500">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Display Name
            </label>
            <input
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              placeholder="e.g., Blood Test Results"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="mt-1 text-sm text-red-500">{errors.displayName.message}</p>
            )}
          </div>

          {/* Document date */}
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Document Date
            </label>
            <input
              type="date"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('documentDate')}
            />
            {errors.documentDate && (
              <p className="mt-1 text-sm text-red-500">{errors.documentDate.message}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-4 py-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-gray-400"
          >
            {isUploading ? (
              <>
                Uploading...
                <ButtonLoadingSpinner />
              </>
            ) : (
              'Upload'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

---

## UI Components (To Be Implemented)

The following components are required to complete the feature. Implementation details are deferred but requirements and data dependencies are specified.

### 1. UploadedDocumentCard

**Location**: `apps/web/src/features/timeline/components/cards/UploadedDocumentCard.tsx`

**Purpose**: Display an uploaded document in the timeline (collapsed and expanded views).

**Requirements**:
- Display `metadata.display_name` as the title
- Display `metadata.date` formatted consistently with other timeline cards
- Show file type icon (PDF icon initially)
- Show `source.file.name` as secondary info
- "View" button to open the PDF viewer
- "Delete" button with confirmation dialog
- Visual indicator if document has links to clinical records (`linked_document_ids.length > 0`)

**Data Requirements**:
- Input: `TimelineRecord` (with `_original` being a `ClinicalDocument` where `isFileUploadSource(doc.source)` is true)
- Actions: `deleteUploadedDocument(db, storage, userId, documentId)`

### 2. ShowUploadedDocumentExpandable

**Location**: `apps/web/src/features/timeline/components/expandables/ShowUploadedDocumentExpandable.tsx`

**Purpose**: Full-screen view of an uploaded document with PDF viewer and link management.

**Requirements**:
- Embed PDF viewer (use existing PDF rendering if available, or `<iframe>` with blob URL)
- Display document metadata (name, date)
- "Manage Links" section showing linked clinical documents
- Button to open `LinkDocumentModal` for adding/removing links
- Delete button with confirmation

**Data Requirements**:
- Input: `ClinicalDocument` (with `isFileUploadSource(doc.source)` = true)
- Hooks: `useLinkedClinicalDocs(uploadedDoc)` for linked clinical documents
- Actions: `deleteUploadedDocument`, storage adapter for reading file via `source.file.opfs_path`

### 3. LinkDocumentModal

**Location**: `apps/web/src/features/timeline/components/LinkDocumentModal.tsx`

**Purpose**: Search and select clinical documents to link to an uploaded document.

**Requirements**:
- Search input with debounced query
- Display search results as selectable list
- Show currently linked documents with remove option
- "Save" commits link changes, "Cancel" discards
- Search should query clinical documents by `metadata.display_name` or `data_record.resource_type`
- Exclude file uploads from search results (only link to connection-sourced clinical data)

**Data Requirements**:
- Input: `ClinicalDocument` (file upload, to show current `linked_document_ids`)
- Search: Query `clinical_documents` filtered by `user_id`, search term, and `source.type: 'connection'`
- Actions: `clinicalDocRepo.addLink()`, `clinicalDocRepo.removeLink()`

### 4. Timeline Integration Point

**Location**: Modify `apps/web/src/features/timeline/components/layout/TimelineItem.tsx`

**Requirements**:
- Use the card registry pattern (defined in `cardRegistry.tsx`)
- `TimelineRecord.sourceType` determines rendering path
- `sourceType === 'file_upload'` routes to `UploadedDocumentCard`
- `sourceType === 'connection'` uses FHIR resource type registry
- No switch statement needed - registry lookup handles routing

**Data Requirements**:
- Single collection query on `clinical_documents` - no merging needed
- File uploads are identified by `source.type === 'file_upload'`
- Timeline items are normalized to `TimelineRecord` before rendering

---

## Orphan Cleanup

Run on app initialization to clean up orphaned OPFS files. Injects `StorageAdapter` for testability.

```typescript
// apps/web/src/features/upload/services/cleanupOrphans.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { StorageAdapter } from './storageAdapter';
import { isFileUploadSource } from '../../../models/clinical-document/ClinicalDocument.type';

export async function cleanupOrphanedFiles(
  db: RxDatabase<DatabaseCollections>,
  storage: StorageAdapter
): Promise<void> {
  if (!storage.isSupported()) return;

  try {
    const storedFiles = await storage.list();

    // Query clinical_documents for file uploads (source.type === 'file_upload')
    const uploadDocs = await db.clinical_documents
      .find({
        selector: {
          'source.type': 'file_upload',
        },
      })
      .exec();

    const dbPaths = new Set(
      uploadDocs
        .filter((d) => isFileUploadSource(d.source))
        .map((d) => d.source.file.opfs_path)
    );

    for (const filePath of storedFiles) {
      if (!dbPaths.has(filePath)) {
        console.warn(`Cleaning up orphaned file: ${filePath}`);
        await storage.delete(filePath);
      }
    }
  } catch (error) {
    console.error('Error during orphan cleanup:', error);
  }
}
```

### Initialization Hook

Call `cleanupOrphanedFiles` in `RxDbProvider` after database is ready:

```typescript
// Update apps/web/src/app/providers/RxDbProvider.tsx

import { cleanupOrphanedFiles } from '../../features/upload/services/cleanupOrphans';
import { createOPFSAdapter } from '../../features/upload/services/storageAdapter';

// Inside the provider, after database initialization:
useEffect(() => {
  if (db) {
    // Run orphan cleanup on app start (fire-and-forget, non-blocking)
    cleanupOrphanedFiles(db, createOPFSAdapter()).catch((err) => {
      console.error('Orphan cleanup failed:', err);
    });
  }
}, [db]);
```

---

## Error Handling Summary

| Error | User Message | Code |
|-------|--------------|------|
| Browser doesn't support OPFS | "Your browser does not support file uploads. Please use Chrome 86+, Edge 86+, Safari 15.2+, or Firefox 111+." | `UNSUPPORTED_BROWSER` |
| Invalid file type | "File type X is not supported. Please upload a PDF file." | `INVALID_TYPE` |
| Storage write failed | "Failed to save document. Please try again." | `STORAGE_ERROR` |

---

## File Structure

```
apps/web/src/
├── models/
│   └── clinical-document/
│       ├── ClinicalDocument.schema.ts    # (modified - add source discriminated union, linked_document_ids)
│       ├── ClinicalDocument.type.ts      # (modified - add DocumentSource union, type guards, helpers)
│       └── ClinicalDocument.migration.ts # (modified - migrate connection_record_id -> source)
│
├── repositories/
│   └── ClinicalDocumentRepository.ts     # (modified - add upload functions: findAllUploads, insertUpload, addLink, removeLink, removeUpload, findByIds, findUploadsLinkedTo)
│
├── features/
│   ├── upload/
│   │   ├── components/
│   │   │   ├── UploadDocumentModal.tsx
│   │   │   └── uploadValidation.ts
│   │   ├── hooks/
│   │   │   └── useUploadedDocuments.tsx  # Uses ClinicalDocumentRepository
│   │   └── services/
│   │       ├── opfsStorage.ts             # OPFS file operations
│   │       ├── storageAdapter.ts          # Interface + OPFS/Memory adapters
│   │       ├── uploadService.ts           # Orchestrates storage + repository
│   │       ├── exportService.ts           # ZIP export
│   │       ├── importService.ts           # ZIP/JSON import
│   │       └── cleanupOrphans.ts
│   │
│   ├── settings/components/
│   │   └── UserDataSettingsGroup.tsx  (modified for export/import)
│   │
│   └── timeline/
│       ├── types/
│       │   └── TimelineRecord.ts      # Normalized timeline record type (NEW)
│       ├── hooks/
│       │   └── useTimelineRecords.ts  # Single collection query
│       ├── components/
│       │   ├── cards/
│       │   │   └── UploadedDocumentCard.tsx    # Card for uploaded docs (NEW)
│       │   ├── expandables/
│       │   │   └── ShowUploadedDocumentExpandable.tsx  # Detail view (NEW)
│       │   ├── layout/
│       │   │   └── TimelineItem.tsx   # (modified - use card registry)
│       │   ├── cardRegistry.tsx       # Source type -> component mapping (NEW)
│       │   └── LinkDocumentModal.tsx  # Link management modal (NEW)
│       └── TimelineTab.tsx            # (uses single collection query)
│
├── test-utils/
│   └── uploadTestData.ts              # Test factories for ClinicalDocument uploads
│
└── app/providers/
    ├── RxDbProvider.tsx               # (modified - orphan cleanup on init)
    └── DatabaseCollections.ts         # (no changes - uses existing clinical_documents)
```

---

## Implementation Order

Follow TDD where possible: target a feature, write tests, implement, validate, then move up the dependency tree.

### Dependency Tree

```
Level 0 (Foundation - no deps)
├── ClinicalDocument.type.ts (discriminated union, type guards)
├── ClinicalDocument.schema.ts (JSON Schema with oneOf)
└── ClinicalDocument.migration.ts

Level 1 (Storage - no upload deps)
├── opfsStorage.ts (low-level OPFS operations)
└── storageAdapter.ts (interface + adapters)

Level 2 (Repository - depends on types)
└── ClinicalDocumentRepository.ts (query/command functions)

Level 3 (Services - depends on repository + storage)
├── uploadService.ts
├── cleanupOrphans.ts
├── exportService.ts
└── importService.ts

Level 4 (Hooks - depends on repository)
└── useUploadedDocuments.tsx (and related hooks)

Level 5 (Timeline Infrastructure - depends on types)
├── TimelineRecord.ts (normalization)
└── cardRegistry.tsx

Level 6 (UI Components - depends on everything)
├── UploadDocumentModal.tsx
├── UploadedDocumentCard.tsx
├── ShowUploadedDocumentExpandable.tsx
└── LinkDocumentModal.tsx
```

### Phase 1: Schema Migration (Breaking Change)

This must happen first because it changes the shape of existing data.

**1.1 Types + Type Guards**
- Target: `ClinicalDocument.type.ts`
- Implement: `DocumentSource` union, type guards, helpers
- Test: Type guard functions return correct boolean

**1.2 Schema**
- Target: `ClinicalDocument.schema.ts`
- Implement: JSON Schema with `oneOf` for source
- Test: Schema validates both source types

**1.3 Migration**
- Target: `ClinicalDocument.migration.ts`
- Implement: Transform `connection_record_id` → `source` object
- Validate: Manual testing during development

**1.4 Existing Code Updates**
- Target: ~30 files that reference `connection_record_id`
- Replace `connection_record_id` with `source.connection_record_id`
- Validate: All existing tests pass, app boots

### Phase 2: Storage Layer

Can be developed in parallel with Phase 1.

**2.1 OPFS Storage**
- Target: `opfsStorage.ts`
- Implement: `saveFileToOPFS`, `readFileFromOPFS`, `deleteFileFromOPFS`, `listOPFSFiles`
- Validate: Manual browser console testing (no unit tests - browser API)

**2.2 Storage Adapter**
- Target: `storageAdapter.ts`
- Implement: `StorageAdapter` interface, `createOPFSAdapter`, `createMemoryAdapter`
- Test: Memory adapter save/read/delete/list

### Phase 3: Repository

Depends on: Phase 1 (types)

**3.1 Query Functions**
- Target: `ClinicalDocumentRepository.ts`
- Implement: `findAllUploads`, `findUploadById`, `findUploadsLinkedTo`, `findByIds`
- Test: Returns correct documents, user isolation, source type filtering

**3.2 Command Functions**
- Target: `ClinicalDocumentRepository.ts`
- Implement: `insertUpload`, `addLink`, `removeLink`, `removeUpload`
- Test: Creates/updates/deletes correctly, user isolation, returns opfs path

### Phase 4: Services

Depends on: Phase 2 (storage), Phase 3 (repository)

**4.1 Upload Service**
- Target: `uploadService.ts`
- Implement: `uploadDocument`, `deleteUploadedDocument`
- Test: Creates document with file_upload source, rejects bad types, cleanup on failure

**4.2 Orphan Cleanup**
- Target: `cleanupOrphans.ts`
- Implement: `cleanupOrphanedFiles`
- Test: Deletes orphans, preserves valid files

**4.3 Export/Import Services**
- Target: `exportService.ts`, `importService.ts`
- Implement: ZIP export with uploads, v1/v2 import
- Test: v1 JSON import, v2 ZIP import, invalid ZIP rejection

### Phase 5: Timeline Infrastructure

Depends on: Phase 1 (types)

**5.1 TimelineRecord Normalization**
- Target: `TimelineRecord.ts`
- Implement: `toTimelineRecord`, type guards
- Test: Normalizes both source types correctly

**5.2 Card Registry**
- Target: `cardRegistry.tsx`
- Implement: `getCardForRecord`, registry mapping
- Validate: Manual testing

### Phase 6: UI Components

Depends on: Everything above

**6.1 Upload Modal** → **6.2 Uploaded Document Card** → **6.3 Detail View** → **6.4 Link Modal**

Validate through manual testing and integration tests where valuable.

### Phase 7: Integration Points

**7.1 Timeline Integration**
- Update `useTimelineRecords.ts`, `TimelineItem.tsx`
- Validate: E2E or manual testing

**7.2 Settings Integration**
- Update `UserDataSettingsGroup.tsx` for export/import
- Validate: Manual testing

**7.3 App Initialization**
- Add `cleanupOrphanedFiles` call in `RxDbProvider.tsx`
- Validate: Manual testing

### Critical Path (Minimum Viable)

```
Types + Schema + Migration → Repository → Storage Adapter → Upload Service
    → Upload Modal → TimelineRecord + Card Registry → UploadedDocumentCard
    → Timeline Integration
```

Everything else (export/import, orphan cleanup, linking, detail view) can follow after core upload-and-display works.

---

## Testing Strategy

### Principles

1. **Dependency injection over mocks** - Pass in `db` and `storage` adapter
2. **Test fixtures over mocks** - Use `createTestUpload()`, `createTestClinicalDoc()` factories
3. **RxDB test harness** - Use `createTestDatabase()` for in-memory DB
4. **No browser APIs** - Skip OPFS tests, use `createMemoryAdapter()` everywhere
5. **Happy path + key failures** - Not 100% coverage

### What NOT to Test

| Item | Reason |
|------|--------|
| `opfsStorage.ts` | Browser API - manual testing |
| `exportWithStreaming` | File System Access API - manual testing |
| React hooks in isolation | Test through components or skip |
| Migration | Run once, validate manually |
| UI component exhaustive coverage | Basic render + key interactions only |

### Storage Adapter Interface

Inject storage to make services testable without OPFS:

```typescript
// apps/web/src/features/upload/services/storageAdapter.ts

import {
  checkOPFSSupport,
  saveFileToOPFS,
  readFileFromOPFS,
  deleteFileFromOPFS,
  listOPFSFiles,
} from './opfsStorage';

export interface StorageAdapter {
  save(file: File, id: string): Promise<string>;
  read(path: string): Promise<File | null>;
  delete(path: string): Promise<void>;
  list(): Promise<string[]>;
  isSupported(): boolean;
}

// Production: OPFS implementation
export function createOPFSAdapter(): StorageAdapter {
  return {
    save: saveFileToOPFS,
    read: readFileFromOPFS,
    delete: deleteFileFromOPFS,
    list: listOPFSFiles,
    isSupported: checkOPFSSupport,
  };
}

// Test: In-memory implementation
export function createMemoryAdapter(): StorageAdapter {
  const files = new Map<string, File>();
  return {
    async save(file, id) {
      const path = `/uploads/${id}.pdf`;
      files.set(path, file);
      return path;
    },
    async read(path) { return files.get(path) || null; },
    async delete(path) { files.delete(path); },
    async list() { return Array.from(files.keys()); },
    isSupported() { return true; },
  };
}
```

### Test Data Factory

```typescript
// apps/web/src/test-utils/uploadTestData.ts

export function createTestUpload(overrides?: Partial<ClinicalDocument>): ClinicalDocument {
  const id = uuid4();
  return {
    id,
    user_id: 'test-user-id',
    source: { type: 'file_upload', file: { opfs_path: `/uploads/${id}.pdf`, name: 'test.pdf', content_type: 'application/pdf' } },
    metadata: { date: new Date().toISOString(), display_name: 'Test Document' },
    linked_document_ids: [],
    ...overrides,
  };
}

export function createTestClinicalDoc(overrides?: Partial<ClinicalDocument>): ClinicalDocument {
  const id = uuid4();
  return {
    id,
    user_id: 'test-user-id',
    source: { type: 'connection', connection_record_id: 'test-provider-connection' },
    metadata: { date: new Date().toISOString(), display_name: 'Test Clinical Record' },
    data_record: { resource_type: 'immunization', content_type: 'application/fhir+json' },
    ...overrides,
  };
}

export function createTestFile(name = 'test.pdf', type = 'application/pdf'): File {
  return new File([new Blob(['%PDF-1.4 test'], { type })], name, { type });
}
```

### Tests by Component

#### Repository Tests (~8 tests)

```typescript
// ClinicalDocumentRepository.spec.ts

describe('findAllUploads', () => {
  it('returns only file_upload sources for user', async () => {
    const upload = createTestUpload({ user_id: 'userA' });
    const clinicalDoc = createTestClinicalDoc({ user_id: 'userA' });
    await db.clinical_documents.bulkInsert([upload, clinicalDoc]);

    const result = await findAllUploads(db, 'userA');

    expect(result).toHaveLength(1);
    expect(result[0].source.type).toBe('file_upload');
  });
});

describe('addLink', () => {
  it('appends to linked_document_ids', async () => {
    const upload = createTestUpload();
    await db.clinical_documents.insert(upload);

    await addLink(db, upload.user_id, upload.id, 'clinical-1');

    const updated = await db.clinical_documents.findOne(upload.id).exec();
    expect(updated.linked_document_ids).toContain('clinical-1');
  });

  it('throws when user does not own document', async () => {
    const upload = createTestUpload({ user_id: 'userA' });
    await db.clinical_documents.insert(upload);

    await expect(addLink(db, 'userB', upload.id, 'doc-1')).rejects.toThrow('Access denied');
  });
});

describe('removeUpload', () => {
  it('deletes document and returns opfs path', async () => {
    const upload = createTestUpload();
    await db.clinical_documents.insert(upload);

    const path = await removeUpload(db, upload.user_id, upload.id);

    expect(path).toBe(upload.source.file.opfs_path);
    expect(await db.clinical_documents.findOne(upload.id).exec()).toBeNull();
  });
});
```

#### Upload Service Tests (~3 tests)

```typescript
// uploadService.spec.ts

describe('uploadDocument', () => {
  it('creates document with file_upload source', async () => {
    const file = createTestFile();
    const result = await uploadDocument(db, storage, file, 'user-1', 'My Doc', '2024-01-15');

    expect(result.source.type).toBe('file_upload');
    expect(result.source.file.content_type).toBe('application/pdf');
    expect(result.data_record).toBeUndefined();
  });

  it('rejects unsupported file types', async () => {
    const file = createTestFile('doc.exe', 'application/x-msdownload');
    await expect(uploadDocument(db, storage, file, 'user-1', 'Bad', '2024-01-15')).rejects.toThrow('not supported');
  });

  it('cleans up storage on DB failure', async () => {
    const existing = createTestUpload({ id: 'forced-id' });
    await db.clinical_documents.insert(existing);
    jest.spyOn(uuid, 'default').mockReturnValueOnce('forced-id');

    await expect(uploadDocument(db, storage, createTestFile(), 'user-1', 'Test', '2024-01-15')).rejects.toThrow();
    expect(await storage.list()).toHaveLength(0);
  });
});
```

#### Orphan Cleanup Tests (~2 tests)

```typescript
// cleanupOrphans.spec.ts

describe('cleanupOrphanedFiles', () => {
  it('deletes files not referenced in DB', async () => {
    await storage.save(createTestFile(), 'orphan-id');
    const upload = createTestUpload();
    await db.clinical_documents.insert(upload);
    await storage.save(createTestFile(), upload.id);

    await cleanupOrphanedFiles(db, storage);

    const files = await storage.list();
    expect(files).toHaveLength(1);
    expect(files[0]).toContain(upload.id);
  });
});
```

#### Import Service Tests (~3 tests)

```typescript
// importService.spec.ts

describe('importBackup', () => {
  it('handles v1 JSON format', async () => {
    const json = JSON.stringify({ collections: { user_documents: [{ id: 'u1' }] } });
    const file = new File([json], 'backup.json', { type: 'application/json' });

    await importBackup(file, db);

    expect(await db.user_documents.findOne('u1').exec()).toBeTruthy();
  });

  it('handles v2 ZIP with uploads', async () => {
    const zipBlob = await createTestZip({
      'database.json': JSON.stringify({
        collections: {
          clinical_documents: [{
            id: 'upload-1', user_id: 'u1',
            source: { type: 'file_upload', file: { opfs_path: '/uploads/upload-1.pdf', name: 'test.pdf', content_type: 'application/pdf' } },
            metadata: { date: '2024-01-15', display_name: 'Test' },
          }],
        },
      }),
      'uploads/upload-1.pdf': '%PDF-1.4',
    });

    await importBackup(new File([zipBlob], 'backup.zip'), db, storage);

    const doc = await db.clinical_documents.findOne('upload-1').exec();
    expect(doc.source.type).toBe('file_upload');
  });

  it('rejects ZIP without database.json', async () => {
    const zipBlob = await createTestZip({ 'random.txt': 'nope' });
    await expect(importBackup(new File([zipBlob], 'bad.zip'), db)).rejects.toThrow('missing database.json');
  });
});
```

#### TimelineRecord Tests (~2 tests)

```typescript
// TimelineRecord.spec.ts

describe('toTimelineRecord', () => {
  it('normalizes file_upload source', () => {
    const doc = createTestUpload();
    const record = toTimelineRecord(doc);

    expect(record.sourceType).toBe('file_upload');
    expect(record.filePath).toBe(doc.source.file.opfs_path);
    expect(record.resourceType).toBeUndefined();
  });

  it('normalizes connection source', () => {
    const doc = createTestClinicalDoc();
    const record = toTimelineRecord(doc);

    expect(record.sourceType).toBe('connection');
    expect(record.connectionId).toBe(doc.source.connection_record_id);
    expect(record.resourceType).toBe('immunization');
  });
});
```

#### Type Guard Tests (~2 tests)

```typescript
// ClinicalDocument.type.spec.ts

describe('isFileUploadSource', () => {
  it('returns true for file_upload', () => {
    const source = { type: 'file_upload', file: { opfs_path: '/x', name: 'x', content_type: 'x' } };
    expect(isFileUploadSource(source)).toBe(true);
  });

  it('returns false for connection', () => {
    const source = { type: 'connection', connection_record_id: 'x' };
    expect(isFileUploadSource(source)).toBe(false);
  });
});
```

#### Validation Tests (~2 tests)

```typescript
// uploadValidation.spec.ts

describe('uploadValidationSchema', () => {
  it('passes with valid input', async () => {
    const input = { file: [createTestFile()], displayName: 'Test', documentDate: new Date() };
    await expect(uploadValidationSchema.validate(input)).resolves.toBeTruthy();
  });

  it('fails when displayName empty', async () => {
    const input = { file: [createTestFile()], displayName: '', documentDate: new Date() };
    await expect(uploadValidationSchema.validate(input)).rejects.toThrow();
  });
});
```

### Test Summary

| Component | Tests | Focus |
|-----------|-------|-------|
| Repository | ~8 | Query/command functions, user isolation |
| Upload Service | ~3 | Orchestration, cleanup on failure |
| Orphan Cleanup | ~2 | Orphan detection |
| Import Service | ~3 | v1 JSON, v2 ZIP, invalid ZIP |
| TimelineRecord | ~2 | Normalization both source types |
| Type Guards | ~2 | Discriminated union guards |
| Validation | ~2 | Valid + invalid input |

**Total: ~22 focused tests**

---

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 86+ |
| Edge | 86+ |
| Safari | 15.2+ |
| Firefox | 111+ |

---

## Sources

- [RxDB Schema Design](https://rxdb.info/rx-schema.html)
- [RxDB Query Documentation](https://rxdb.info/rx-query.html)
- [RxDB v12 - Array Index Removal](https://rxdb.info/releases/12.0.0.html)
