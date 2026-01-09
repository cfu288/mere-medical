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

### Unified Collection with Pseudo-Connection

Store uploaded documents in `clinical_documents` collection with a per-user "User Uploads" pseudo-connection.

**Rationale**:
1. Single collection query for timeline - no merge logic needed
2. Existing connection-based filtering works naturally
3. "Delete all from source" works for user uploads
4. Consistent schema and query patterns
5. Simpler pagination (single sorted collection)

**Trade-offs**:
1. Schema migration to add `opfs_path` and `file_name` fields
2. Pseudo-connection must be hidden from connections UI
3. `resource_type` overloaded for upload types

### Embedded Array for Links

Store links as an **embedded array** (`linked_document_ids`) on uploaded clinical documents.

**Rationale**:
1. NoSQL-idiomatic pattern
2. RxDB doesn't support atomic transactions across collections
3. Deleting an upload removes all its links automatically

**Note on Array Queries**: RxDB removed support for array field indexes in v12.0.0. Queries on `linked_document_ids` will perform full collection scans. This is acceptable given expected data volumes.

---

## Data Model

### Pseudo-Connection for User Uploads

Each user gets a "User Uploads" connection record that groups all manually uploaded documents:

```typescript
// apps/web/src/features/upload/services/uploadConnectionService.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import uuid4 from '../../../shared/utils/UUIDUtils';

export const USER_UPLOAD_SOURCE = 'user_upload';
export const USER_UPLOAD_CONNECTION_NAME = 'My Uploads';

/**
 * Get or create the pseudo-connection for user uploads.
 * This connection is hidden from the connections UI but used to group uploaded documents.
 */
export async function getOrCreateUploadConnection(
  db: RxDatabase<DatabaseCollections>,
  userId: string
): Promise<string> {
  // Check if pseudo-connection exists
  const existing = await db.connection_documents
    .findOne({
      selector: {
        user_id: userId,
        source: USER_UPLOAD_SOURCE,
      },
    })
    .exec();

  if (existing) return existing.id;

  // Create pseudo-connection for user uploads
  const connectionId = uuid4();
  await db.connection_documents.insert({
    id: connectionId,
    user_id: userId,
    source: USER_UPLOAD_SOURCE,
    name: USER_UPLOAD_CONNECTION_NAME,
    location: '',
    // No auth - this is a local-only pseudo-connection
  });

  return connectionId;
}

/**
 * Check if a connection is the user upload pseudo-connection.
 * Used to hide from connections UI.
 */
export function isUploadConnection(connection: { source?: string }): boolean {
  return connection.source === USER_UPLOAD_SOURCE;
}
```

### Schema Extension: `clinical_documents`

Add optional fields to support uploaded documents:

```typescript
// Update apps/web/src/models/clinical-document/ClinicalDocument.schema.ts

// Add to data_record.properties:
data_record: {
  type: 'object',
  properties: {
    // ... existing properties ...
    raw: { /* existing */ },
    format: { /* existing */ },
    content_type: { /* existing */ },
    resource_type: { /* existing */ },

    // NEW: For uploaded documents only
    opfs_path: { type: 'string' },      // OPFS storage path
    file_name: { type: 'string' },       // Original filename
  },
},

// Add to properties (top level):
linked_document_ids: {
  type: 'array',
  items: { type: 'string' },
  default: [],
},
```

### New Resource Types

Add upload-specific resource types:

```typescript
// Update apps/web/src/models/clinical-document/ClinicalDocument.type.ts

export type ClinicalDocumentResourceType =
  | 'immunization'
  | 'condition'
  // ... existing types ...
  | 'uploaded_pdf'      // NEW
  | 'uploaded_dicom'    // NEW (future)
  | 'uploaded_image';   // NEW (future)

// Type guard for uploaded documents
export function isUploadedResourceType(type: string): boolean {
  return type.startsWith('uploaded_');
}
```

### TypeScript Interface Extension

```typescript
// Update apps/web/src/models/clinical-document/ClinicalDocument.type.ts

export interface ClinicalDocument<T = unknown> {
  id: string;
  user_id: string;
  connection_record_id: string;  // Pseudo-connection ID for uploads

  metadata?: {
    date?: string;
    display_name?: string;
    // ... existing fields
  };

  data_record: {
    raw?: T;
    format?: string;
    content_type?: string;
    resource_type: ClinicalDocumentResourceType;
    version_history?: T[];

    // For uploaded documents only
    opfs_path?: string;
    file_name?: string;
  };

  // For uploaded documents: links to other clinical documents
  linked_document_ids?: string[];
}
```

### Migration

```typescript
// apps/web/src/models/clinical-document/ClinicalDocument.migration.ts

// Add migration for new version
export const ClinicalDocumentMigrations: MigrationStrategies = {
  // ... existing migrations ...

  // Migration to add upload support fields
  [NEXT_VERSION]: (oldDoc) => {
    return {
      ...oldDoc,
      linked_document_ids: oldDoc.linked_document_ids || [],
      // opfs_path and file_name are optional, no migration needed
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

import { ClinicalDocument, ClinicalDocumentResourceType } from '../../../models/clinical-document/ClinicalDocument.type';

export interface TimelineRecord {
  // Identity
  id: string;

  // Display fields (unified)
  date: string;
  displayName: string;
  recordType: ClinicalDocumentResourceType;

  // For uploaded docs
  isUploaded: boolean;
  storagePath?: string;
  fileName?: string;
  linkedDocumentIds?: string[];

  // Original document for detail views
  _original: ClinicalDocument;
}

// Adapter: ClinicalDocument -> TimelineRecord
export function toTimelineRecord(doc: ClinicalDocument): TimelineRecord {
  const isUploaded = doc.data_record.resource_type?.startsWith('uploaded_') || false;

  return {
    id: doc.id,
    date: doc.metadata?.date || '',
    displayName: doc.metadata?.display_name || 'Unknown',
    recordType: doc.data_record.resource_type,
    isUploaded,
    storagePath: doc.data_record.opfs_path,
    fileName: doc.data_record.file_name,
    linkedDocumentIds: doc.linked_document_ids,
    _original: doc,
  };
}

// Get original document (for detail views)
export function getOriginalDocument(record: TimelineRecord): ClinicalDocument {
  return record._original;
}
```

### Card Registry

```typescript
// apps/web/src/features/timeline/components/cardRegistry.tsx

import { ClinicalDocumentResourceType } from '../../../models/clinical-document/ClinicalDocument.type';
import { TimelineRecord } from '../types/TimelineRecord';

// Import all card components
import { ImmunizationCard } from './cards/ImmunizationCard';
import { ConditionCard } from './cards/ConditionCard';
import { ProcedureCard } from './cards/ProcedureCard';
import { ObservationCard } from './cards/ObservationCard';
import { MedicationCard } from './cards/MedicationCard';
import { UploadedDocumentCard } from './cards/UploadedDocumentCard';
// ... other imports

type CardComponent = React.ComponentType<{ record: TimelineRecord }>;

const cardRegistry: Partial<Record<ClinicalDocumentResourceType, CardComponent>> = {
  // Clinical document types
  immunization: ImmunizationCard,
  condition: ConditionCard,
  procedure: ProcedureCard,
  observation: ObservationCard,
  medicationstatement: MedicationCard,
  medicationrequest: MedicationCard,
  // ... other clinical types

  // Uploaded document types
  uploaded_pdf: UploadedDocumentCard,
  uploaded_dicom: UploadedDocumentCard,
  uploaded_image: UploadedDocumentCard,
};

export function getCardForRecord(record: TimelineRecord): CardComponent | null {
  return cardRegistry[record.recordType] || null;
}

// Fallback card for unknown types
export function UnknownRecordCard({ record }: { record: TimelineRecord }) {
  return (
    <div className="p-4 bg-gray-50 rounded">
      <span className="text-gray-500">Unknown: {record.recordType}</span>
    </div>
  );
}
```

---

## Query Patterns and Performance

### Expected Query Patterns

With the unified collection approach, all queries use `clinical_documents`:

| Query | Use Case | Index Used | Performance |
|-------|----------|------------|-------------|
| Get timeline sorted by date | Timeline display | `user_id`, `metadata.date` | ✅ Good |
| Filter by resource type | Show only PDFs | `data_record.resource_type` | ✅ Good |
| Get linked docs FROM upload | View upload detail | Direct ID lookup | ✅ Good |
| Get uploads linked TO clinical doc | View clinical doc detail | **Full scan on uploads** | ⚠️ O(n) |
| Filter by connection | Show uploads only | `connection_record_id` | ✅ Good |

### Reverse Lookup Performance Trade-off

The query "find uploads linked to a clinical document" requires filtering uploaded documents by `linked_document_ids`. This is acceptable because:

1. **Expected volume**: Most users will have < 100 uploaded documents
2. **Query frequency**: Only triggered when viewing a clinical document detail
3. **Alternative complexity**: Bidirectional links require manual sync

---

## Repository: `ClinicalDocumentRepository`

Extend the existing `ClinicalDocumentRepository` with upload-specific functions. All queries use `clinical_documents` collection.

```typescript
// Update apps/web/src/repositories/ClinicalDocumentRepository.ts

import { RxDatabase, RxDocument } from 'rxdb';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseCollections } from '../app/providers/DatabaseCollections';
import { ClinicalDocument, isUploadedResourceType } from '../models/clinical-document/ClinicalDocument.type';

// ============ Existing Functions ============

export async function deleteDocumentsByConnectionId(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  connectionId: string,
): Promise<void> {
  await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        connection_record_id: connectionId,
      },
    })
    .remove();
}

// ============ Upload-Specific Query Functions ============

/**
 * Find all uploaded documents for a user.
 */
export async function findAllUploads(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Promise<ClinicalDocument[]> {
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'data_record.resource_type': { $regex: '^uploaded_' },
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

  if (!isUploadedResourceType(doc.data_record.resource_type)) {
    throw new Error(`Document ${id} is not an uploaded document`);
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
 * Insert an uploaded document.
 */
export async function insertUpload(
  db: RxDatabase<DatabaseCollections>,
  data: ClinicalDocument,
): Promise<RxDocument<ClinicalDocument>> {
  if (!data.user_id) {
    throw new Error('Cannot create document without user_id');
  }
  if (!isUploadedResourceType(data.data_record.resource_type)) {
    throw new Error('Use insertUpload only for uploaded documents');
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
 * Remove an uploaded document and return its OPFS path for cleanup.
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

  const opfsPath = doc.data_record.opfs_path;
  await doc.remove();
  return opfsPath || null;
}

// ============ Reactive Functions ============

/**
 * Watch all uploads for a user.
 */
export function watchAllUploads(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
): Observable<ClinicalDocument[]> {
  return db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'data_record.resource_type': { $regex: '^uploaded_' },
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

With the unified collection, the timeline uses a single query. No merging required.

### Single Collection Query

With the unified collection, the timeline query is a single RxDB query - no merging needed:

```typescript
// apps/web/src/features/timeline/hooks/useTimelineRecords.ts

import { toTimelineRecord, TimelineRecord } from '../types/TimelineRecord';

export async function fetchTimelineRecords(
  db: RxDatabase<DatabaseCollections>,
  userId: string,
  options: { page: number; pageSize: number }
): Promise<TimelineRecord[]> {
  // Single query - uploads are just clinical_documents with resource_type starting with 'uploaded_'
  const docs = await db.clinical_documents
    .find({
      selector: {
        user_id: userId,
        'data_record.resource_type': {
          $nin: ['patient', 'careplan', 'allergyintolerance', 'documentreference_attachment', 'provenance'],
        },
        'metadata.date': { $nin: [null, undefined, ''] },
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

Orchestrates storage + repository + pseudo-connection. Injects `StorageAdapter` for testability.

```typescript
// apps/web/src/features/upload/services/uploadService.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import uuid4 from '../../../shared/utils/UUIDUtils';
import { StorageAdapter } from './storageAdapter';
import { getOrCreateUploadConnection } from './uploadConnectionService';
import * as clinicalDocRepo from '../../../repositories/ClinicalDocumentRepository';

const SUPPORTED_TYPES: Record<string, string> = {
  'application/pdf': 'uploaded_pdf',
  // Future: 'application/dicom': 'uploaded_dicom',
  // Future: 'image/png': 'uploaded_image',
};

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
  const resourceType = SUPPORTED_TYPES[file.type];
  if (!resourceType) {
    throw new UploadError(
      `File type "${file.type}" is not supported. Please upload a PDF file.`,
      'INVALID_TYPE'
    );
  }

  // 2. Get or create the pseudo-connection for user uploads
  const connectionId = await getOrCreateUploadConnection(db, userId);

  // 3. Generate ID and save to storage
  const id = uuid4();
  let opfsPath: string | null = null;

  try {
    opfsPath = await storage.save(file, id);

    // 4. Create clinical document record via repository
    const doc = await clinicalDocRepo.insertUpload(db, {
      id,
      user_id: userId,
      connection_record_id: connectionId,
      metadata: {
        date: documentDate,
        display_name: displayName,
      },
      data_record: {
        resource_type: resourceType as any,
        content_type: file.type,
        file_name: file.name,
        opfs_path: opfsPath,
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
import { isUploadedResourceType } from '../../../models/clinical-document/ClinicalDocument.type';

/**
 * Check if File System Access API is supported (Chrome/Edge)
 */
function supportsFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window;
}

/**
 * Get uploaded documents from clinical_documents collection.
 * Uploads are identified by resource_type starting with 'uploaded_'.
 */
async function getUploadedDocuments(db: RxDatabase<DatabaseCollections>) {
  const docs = await db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': { $regex: '^uploaded_' },
      },
    })
    .exec();
  return docs.filter((d) => d.data_record.opfs_path); // Only docs with OPFS files
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

    // 2. Stream OPFS files directly to ZIP (uploads are in clinical_documents)
    const uploads = await getUploadedDocuments(db);

    for (const upload of uploads) {
      const opfsPath = upload.data_record.opfs_path;
      if (!opfsPath) continue;

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

  // 2. Add OPFS files to uploads/ folder (uploads are in clinical_documents)
  const uploads = await getUploadedDocuments(db);

  for (const upload of uploads) {
    const opfsPath = upload.data_record.opfs_path;
    if (!opfsPath) continue;

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

  // 3. Restore OPFS files for uploaded documents (now in clinical_documents)
  let uploadCount = 0;
  if (checkOPFSSupport()) {
    // Query clinical_documents for uploads (resource_type starts with 'uploaded_')
    const uploadDocs = await db.clinical_documents
      .find({
        selector: {
          'data_record.resource_type': { $regex: '^uploaded_' },
          'data_record.opfs_path': { $exists: true },
        },
      })
      .exec();

    const uploadEntries = entries.filter((e) => e.filename.startsWith('uploads/'));

    for (const doc of uploadDocs) {
      const opfsPath = doc.data_record.opfs_path;
      if (!opfsPath) continue;

      const fileName = opfsPath.split('/').pop();
      if (!fileName) continue;

      const zipEntry = uploadEntries.find((e) => e.filename === `uploads/${fileName}`);
      if (zipEntry && zipEntry.getData) {
        const blob = await zipEntry.getData(new BlobWriter());
        const restoredFile = new File([blob], doc.data_record.file_name || fileName, {
          type: doc.data_record.content_type,
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
  // Check for uploaded documents in clinical_documents (resource_type starts with 'uploaded_')
  const uploads = await db.clinical_documents
    .find({
      selector: {
        'data_record.resource_type': { $regex: '^uploaded_' },
        'data_record.opfs_path': { $exists: true },
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
- Show `data_record.file_name` as secondary info
- "View" button to open the PDF viewer
- "Delete" button with confirmation dialog
- Visual indicator if document has links to clinical records (`linked_document_ids.length > 0`)

**Data Requirements**:
- Input: `TimelineRecord` (with `_original` being a `ClinicalDocument` where `isUploaded` is true)
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
- Input: `ClinicalDocument` (with `isUploadedResourceType(doc.data_record.resource_type)` = true)
- Hooks: `useLinkedClinicalDocs(uploadedDoc)` for linked clinical documents
- Actions: `deleteUploadedDocument`, storage adapter for reading file via `opfs_path`

### 3. LinkDocumentModal

**Location**: `apps/web/src/features/timeline/components/LinkDocumentModal.tsx`

**Purpose**: Search and select clinical documents to link to an uploaded document.

**Requirements**:
- Search input with debounced query
- Display search results as selectable list
- Show currently linked documents with remove option
- "Save" commits link changes, "Cancel" discards
- Search should query clinical documents by `metadata.display_name` or `data_record.resource_type`
- Exclude uploaded documents from search results (only link to synced clinical data)

**Data Requirements**:
- Input: `ClinicalDocument` (uploaded doc, to show current `linked_document_ids`)
- Search: Query `clinical_documents` filtered by `user_id`, search term, and excluding `uploaded_*` resource types
- Actions: `clinicalDocRepo.addLink()`, `clinicalDocRepo.removeLink()`

### 4. Timeline Integration Point

**Location**: Modify `apps/web/src/features/timeline/components/layout/TimelineItem.tsx`

**Requirements**:
- Use the card registry pattern (defined in `cardRegistry.tsx`)
- `TimelineRecord.recordType` determines which card component renders
- `uploaded_pdf`, `uploaded_dicom`, `uploaded_image` route to `UploadedDocumentCard`
- No switch statement needed - registry lookup handles routing

**Data Requirements**:
- Single collection query on `clinical_documents` - no merging needed
- Uploads are identified by `resource_type` starting with `uploaded_`
- Timeline items are normalized to `TimelineRecord` before rendering

### 5. Connections List Filter

**Location**: Modify connections list UI (e.g., `ConnectionsTab.tsx` or similar)

**Requirements**:
- Filter out the pseudo-connection from the connections list
- Use `isUploadConnection(connection)` helper to identify
- Pseudo-connection should not appear in "Manage Connections" view

**Data Requirements**:
- `isUploadConnection` from `uploadConnectionService.ts`
- Connection list filtering before render

---

## Orphan Cleanup

Run on app initialization to clean up orphaned OPFS files. Injects `StorageAdapter` for testability.

```typescript
// apps/web/src/features/upload/services/cleanupOrphans.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { StorageAdapter } from './storageAdapter';

export async function cleanupOrphanedFiles(
  db: RxDatabase<DatabaseCollections>,
  storage: StorageAdapter
): Promise<void> {
  if (!storage.isSupported()) return;

  try {
    const storedFiles = await storage.list();

    // Query clinical_documents for uploads (resource_type starts with 'uploaded_')
    const uploadDocs = await db.clinical_documents
      .find({
        selector: {
          'data_record.resource_type': { $regex: '^uploaded_' },
          'data_record.opfs_path': { $exists: true },
        },
      })
      .exec();

    const dbPaths = new Set(
      uploadDocs
        .map((d) => d.data_record.opfs_path)
        .filter((p): p is string => !!p)
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
│       ├── ClinicalDocument.schema.ts    # (modified - add opfs_path, file_name, linked_document_ids)
│       ├── ClinicalDocument.type.ts      # (modified - add uploaded_* resource types, isUploadedResourceType)
│       └── ClinicalDocument.migration.ts # (modified - add migration for new fields)
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
│   │       ├── uploadConnectionService.ts # Pseudo-connection management (NEW)
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
│       │   ├── cardRegistry.tsx       # Resource type -> component mapping (NEW)
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

## Testing Strategy

Uses existing patterns: in-memory RxDB via `createTestDatabase()`, test data factories with overrides, and dependency injection for browser APIs.

### Storage Adapter Interface

Inject storage to make upload/cleanup services testable without OPFS:

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

import uuid4 from '../shared/utils/UUIDUtils';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';

/**
 * Create a test uploaded document (stored in clinical_documents with uploaded_* resource_type)
 */
export function createTestUpload(
  overrides?: Partial<ClinicalDocument>
): ClinicalDocument {
  const id = uuid4();
  return {
    id,
    user_id: 'test-user-id',
    connection_record_id: 'test-upload-connection', // Pseudo-connection for uploads
    metadata: {
      date: new Date().toISOString(),
      display_name: 'Test Document',
    },
    data_record: {
      resource_type: 'uploaded_pdf',
      content_type: 'application/pdf',
      file_name: 'test.pdf',
      opfs_path: `/uploads/${id}.pdf`,
    },
    linked_document_ids: [],
    ...overrides,
  };
}

export function createTestFile(name = 'test.pdf', type = 'application/pdf'): File {
  const content = new Blob(['%PDF-1.4 test content'], { type });
  return new File([content], name, { type });
}

export function createMultipleUploads(
  count: number,
  userId = 'test-user-id'
): ClinicalDocument[] {
  return Array.from({ length: count }, (_, i) =>
    createTestUpload({
      user_id: userId,
      metadata: {
        date: new Date(Date.now() - i * 86400000).toISOString(),
        display_name: `Document ${i + 1}`,
      },
    })
  );
}

/**
 * Create a test clinical document (non-uploaded, synced from provider)
 */
export function createTestClinicalDoc(
  overrides?: Partial<ClinicalDocument>
): ClinicalDocument {
  const id = uuid4();
  return {
    id,
    user_id: 'test-user-id',
    connection_record_id: 'test-provider-connection',
    metadata: {
      date: new Date().toISOString(),
      display_name: 'Test Clinical Record',
    },
    data_record: {
      resource_type: 'immunization',
      content_type: 'application/fhir+json',
    },
    ...overrides,
  };
}
```

### Test Files

#### 1. Repository Tests (Upload Functions in ClinicalDocumentRepository)

```typescript
// apps/web/src/repositories/ClinicalDocumentRepository.spec.ts

import * as clinicalDocRepo from './ClinicalDocumentRepository';
import { createTestUpload, createMultipleUploads, createTestClinicalDoc } from '../test-utils/uploadTestData';

describe('ClinicalDocumentRepository - Upload Functions', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => { db = await createTestDatabase(); });
  afterEach(async () => { await cleanupTestDatabase(db); });

  describe('query functions', () => {
    describe('findUploadById', () => {
      it('returns upload when found', async () => {
        const upload = createTestUpload();
        await db.clinical_documents.insert(upload);

        const result = await clinicalDocRepo.findUploadById(db, upload.user_id, upload.id);

        expect(result).toBeTruthy();
        expect(result?.id).toBe(upload.id);
      });

      it('returns null when not found', async () => {
        const result = await clinicalDocRepo.findUploadById(db, 'user-1', 'non-existent');
        expect(result).toBeNull();
      });

      it('enforces user isolation', async () => {
        const upload = createTestUpload({ user_id: 'userA' });
        await db.clinical_documents.insert(upload);

        await expect(
          clinicalDocRepo.findUploadById(db, 'userB', upload.id)
        ).rejects.toThrow('Access denied');
      });

      it('throws when document is not an upload', async () => {
        const clinicalDoc = createTestClinicalDoc(); // resource_type: 'immunization'
        await db.clinical_documents.insert(clinicalDoc);

        await expect(
          clinicalDocRepo.findUploadById(db, clinicalDoc.user_id, clinicalDoc.id)
        ).rejects.toThrow('not an uploaded document');
      });
    });

    describe('findAllUploads', () => {
      it('returns all uploads for user sorted by date desc', async () => {
        const uploads = createMultipleUploads(3, 'userA');
        await db.clinical_documents.bulkInsert(uploads);

        const result = await clinicalDocRepo.findAllUploads(db, 'userA');

        expect(result).toHaveLength(3);
      });

      it('only returns uploads for specified user', async () => {
        const uploadsA = createMultipleUploads(2, 'userA');
        const uploadsB = createMultipleUploads(2, 'userB');
        await db.clinical_documents.bulkInsert([...uploadsA, ...uploadsB]);

        const result = await clinicalDocRepo.findAllUploads(db, 'userA');

        expect(result).toHaveLength(2);
        expect(result.every((u) => u.user_id === 'userA')).toBe(true);
      });

      it('does not return non-upload clinical documents', async () => {
        const upload = createTestUpload({ user_id: 'userA' });
        const clinicalDoc = createTestClinicalDoc({ user_id: 'userA' });
        await db.clinical_documents.bulkInsert([upload, clinicalDoc]);

        const result = await clinicalDocRepo.findAllUploads(db, 'userA');

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(upload.id);
      });
    });

    describe('findUploadsLinkedTo', () => {
      it('returns uploads linked to clinical doc (full scan)', async () => {
        const upload1 = createTestUpload({ user_id: 'userA', linked_document_ids: ['target-doc'] });
        const upload2 = createTestUpload({ user_id: 'userA', linked_document_ids: ['other-doc'] });
        const upload3 = createTestUpload({ user_id: 'userA', linked_document_ids: ['target-doc'] });
        await db.clinical_documents.bulkInsert([upload1, upload2, upload3]);

        const result = await clinicalDocRepo.findUploadsLinkedTo(db, 'userA', 'target-doc');

        expect(result).toHaveLength(2);
        expect(result.map((u) => u.id).sort()).toEqual([upload1.id, upload3.id].sort());
      });

      it('returns empty array when no uploads linked', async () => {
        const result = await clinicalDocRepo.findUploadsLinkedTo(db, 'userA', 'target-doc');
        expect(result).toEqual([]);
      });
    });
  });

  describe('command functions', () => {
    describe('addLink', () => {
      it('adds clinical doc ID to links array', async () => {
        const upload = createTestUpload();
        await db.clinical_documents.insert(upload);

        await clinicalDocRepo.addLink(db, upload.user_id, upload.id, 'clinical-doc-1');

        const updated = await db.clinical_documents.findOne(upload.id).exec();
        expect(updated?.linked_document_ids).toContain('clinical-doc-1');
      });

      it('does not duplicate existing links', async () => {
        const upload = createTestUpload({ linked_document_ids: ['doc-1'] });
        await db.clinical_documents.insert(upload);

        await clinicalDocRepo.addLink(db, upload.user_id, upload.id, 'doc-1');

        const updated = await db.clinical_documents.findOne(upload.id).exec();
        expect(updated?.linked_document_ids).toHaveLength(1);
      });

      it('throws when document not found', async () => {
        await expect(
          clinicalDocRepo.addLink(db, 'user-1', 'non-existent', 'doc-1')
        ).rejects.toThrow('not found');
      });

      it('enforces user isolation', async () => {
        const upload = createTestUpload({ user_id: 'userA' });
        await db.clinical_documents.insert(upload);

        await expect(
          clinicalDocRepo.addLink(db, 'userB', upload.id, 'doc-1')
        ).rejects.toThrow('Access denied');
      });
    });

    describe('removeLink', () => {
      it('removes clinical doc ID from links array', async () => {
        const upload = createTestUpload({ linked_document_ids: ['doc-1', 'doc-2'] });
        await db.clinical_documents.insert(upload);

        await clinicalDocRepo.removeLink(db, upload.user_id, upload.id, 'doc-1');

        const updated = await db.clinical_documents.findOne(upload.id).exec();
        expect(updated?.linked_document_ids).toEqual(['doc-2']);
      });

      it('handles non-existent upload gracefully', async () => {
        await expect(
          clinicalDocRepo.removeLink(db, 'user-1', 'non-existent', 'doc-1')
        ).resolves.not.toThrow();
      });
    });

    describe('removeUpload', () => {
      it('removes upload and returns opfs path for cleanup', async () => {
        const upload = createTestUpload();
        await db.clinical_documents.insert(upload);

        const opfsPath = await clinicalDocRepo.removeUpload(db, upload.user_id, upload.id);

        expect(opfsPath).toBe(upload.data_record.opfs_path);
        const deleted = await db.clinical_documents.findOne(upload.id).exec();
        expect(deleted).toBeNull();
      });

      it('returns null when user isolation prevents delete', async () => {
        const upload = createTestUpload({ user_id: 'userA' });
        await db.clinical_documents.insert(upload);

        const result = await clinicalDocRepo.removeUpload(db, 'userB', upload.id);

        expect(result).toBeNull();
        const stillExists = await db.clinical_documents.findOne(upload.id).exec();
        expect(stillExists).toBeTruthy();
      });
    });
  });
});
```

#### 2. Upload Service Tests

```typescript
// apps/web/src/features/upload/services/uploadService.spec.ts

describe('uploadDocument', () => {
  let db: RxDatabase<DatabaseCollections>;
  let storage: StorageAdapter;

  beforeEach(async () => {
    db = await createTestDatabase();
    storage = createMemoryAdapter();
  });
  afterEach(async () => { await cleanupTestDatabase(db); });

  it('saves file to storage and creates DB record in clinical_documents', async () => {
    const file = createTestFile();

    const result = await uploadDocument(db, storage, file, 'user-1', 'My Doc', '2024-01-15T00:00:00Z');

    expect(result.id).toBeTruthy();
    expect(result.metadata?.display_name).toBe('My Doc');
    expect(result.data_record.content_type).toBe('application/pdf');
    expect(result.data_record.resource_type).toBe('uploaded_pdf');

    // Verify stored in clinical_documents collection
    const dbDoc = await db.clinical_documents.findOne(result.id).exec();
    expect(dbDoc).toBeTruthy();

    const storedFile = await storage.read(result.data_record.opfs_path);
    expect(storedFile).toBeTruthy();
  });

  it('rejects unsupported file types', async () => {
    const file = createTestFile('test.exe', 'application/x-msdownload');

    await expect(
      uploadDocument(db, storage, file, 'user-1', 'Bad File', '2024-01-15T00:00:00Z')
    ).rejects.toThrow('not supported');
  });

  it('cleans up storage if DB insert fails', async () => {
    const file = createTestFile();
    // Force DB failure by inserting duplicate
    const existing = createTestUpload();
    await db.clinical_documents.insert(existing);

    // Mock uuid4 to return same ID (would cause duplicate key)
    jest.spyOn(require('../../../shared/utils/UUIDUtils'), 'default')
      .mockReturnValueOnce(existing.id);

    await expect(
      uploadDocument(db, storage, file, 'user-1', 'Test', '2024-01-15T00:00:00Z')
    ).rejects.toThrow();

    // Storage should be cleaned up
    const files = await storage.list();
    expect(files).toHaveLength(0);
  });

  it('creates pseudo-connection for user if not exists', async () => {
    const file = createTestFile();

    const result = await uploadDocument(db, storage, file, 'user-1', 'My Doc', '2024-01-15T00:00:00Z');

    // Verify pseudo-connection was created
    const connection = await db.connection_documents
      .findOne({ selector: { source: 'user_upload', user_id: 'user-1' } })
      .exec();
    expect(connection).toBeTruthy();
    expect(result.connection_record_id).toBe(connection?.id);
  });
});

describe('deleteUploadedDocument', () => {
  it('removes both DB record and storage file', async () => {
    const db = await createTestDatabase();
    const storage = createMemoryAdapter();
    const upload = createTestUpload();
    await db.clinical_documents.insert(upload);
    await storage.save(createTestFile(), upload.id);

    await deleteUploadedDocument(db, storage, upload.user_id, upload.id);

    const dbDoc = await db.clinical_documents.findOne(upload.id).exec();
    expect(dbDoc).toBeNull();

    const file = await storage.read(upload.data_record.opfs_path!);
    expect(file).toBeNull();

    await cleanupTestDatabase(db);
  });
});
```

#### 3. Validation Tests

```typescript
// apps/web/src/features/upload/components/uploadValidation.spec.ts

describe('uploadValidationSchema', () => {
  it('passes with valid input', async () => {
    const input = {
      file: [createTestFile()] as unknown as FileList,
      displayName: 'Test Doc',
      documentDate: new Date('2024-01-15'),
    };

    await expect(uploadValidationSchema.validate(input)).resolves.toBeTruthy();
  });

  it('fails when file is missing', async () => {
    const input = { displayName: 'Test', documentDate: new Date() };

    await expect(uploadValidationSchema.validate(input)).rejects.toThrow('file');
  });

  it('fails when displayName is empty', async () => {
    const input = {
      file: [createTestFile()] as unknown as FileList,
      displayName: '',
      documentDate: new Date(),
    };

    await expect(uploadValidationSchema.validate(input)).rejects.toThrow('Display name');
  });

  it('fails when documentDate is missing', async () => {
    const input = {
      file: [createTestFile()] as unknown as FileList,
      displayName: 'Test',
    };

    await expect(uploadValidationSchema.validate(input)).rejects.toThrow('date');
  });
});
```

#### 4. Export/Import Tests

```typescript
// apps/web/src/features/upload/services/exportImport.spec.ts

import { BlobWriter, ZipWriter, BlobReader, ZipReader, TextReader } from '@zip.js/zip.js';

// Helper to create test ZIP files using zip.js
async function createTestZip(
  files: Record<string, string | Blob>
): Promise<Blob> {
  const blobWriter = new BlobWriter('application/zip');
  const zipWriter = new ZipWriter(blobWriter);

  for (const [name, content] of Object.entries(files)) {
    if (typeof content === 'string') {
      await zipWriter.add(name, new TextReader(content));
    } else {
      await zipWriter.add(name, new BlobReader(content));
    }
  }

  await zipWriter.close();
  return blobWriter.getData();
}

// Helper to read ZIP contents for assertions
async function readZipEntries(blob: Blob): Promise<string[]> {
  const zipReader = new ZipReader(new BlobReader(blob));
  const entries = await zipReader.getEntries();
  const names = entries.map((e) => e.filename);
  await zipReader.close();
  return names;
}

describe('exportAsZip', () => {
  let db: RxDatabase<DatabaseCollections>;
  let storage: StorageAdapter;

  beforeEach(async () => {
    db = await createTestDatabase();
    storage = createMemoryAdapter();
  });
  afterEach(async () => { await cleanupTestDatabase(db); });

  it('creates ZIP with database.json and uploads folder', async () => {
    // Upload is stored in clinical_documents with resource_type 'uploaded_pdf'
    const upload = createTestUpload();
    await db.clinical_documents.insert(upload);
    await storage.save(createTestFile(), upload.id);

    const blob = await exportAsZip(db, storage);

    const entries = await readZipEntries(blob);
    expect(entries).toContain('database.json');
    expect(entries.some((e) => e.startsWith('uploads/'))).toBe(true);
  });

  it('only exports files for uploaded documents (resource_type starts with uploaded_)', async () => {
    const upload = createTestUpload();
    const clinicalDoc = createTestClinicalDoc(); // non-upload clinical doc
    await db.clinical_documents.bulkInsert([upload, clinicalDoc]);
    await storage.save(createTestFile(), upload.id);

    const blob = await exportAsZip(db, storage);

    const entries = await readZipEntries(blob);
    // Should have exactly one upload file
    const uploadEntries = entries.filter((e) => e.startsWith('uploads/'));
    expect(uploadEntries).toHaveLength(1);
  });
});

describe('importBackup', () => {
  it('imports v1 JSON format (backward compatible)', async () => {
    const db = await createTestDatabase();
    const jsonData = { collections: { user_documents: [{ id: 'u1', is_default_user: true }] } };
    const file = new File([JSON.stringify(jsonData)], 'backup.json', { type: 'application/json' });

    await importBackup(file, db, createMemoryAdapter());

    const user = await db.user_documents.findOne('u1').exec();
    expect(user).toBeTruthy();

    await cleanupTestDatabase(db);
  });

  it('imports v2 ZIP format with uploads (in clinical_documents)', async () => {
    // Create a valid ZIP in memory using zip.js
    // Uploads are now stored in clinical_documents with resource_type 'uploaded_pdf'
    const zipBlob = await createTestZip({
      'database.json': JSON.stringify({
        collections: {
          clinical_documents: [{
            id: 'upload-1',
            user_id: 'u1',
            connection_record_id: 'upload-connection',
            data_record: {
              resource_type: 'uploaded_pdf',
              opfs_path: '/uploads/upload-1.pdf',
              file_name: 'test.pdf',
            },
          }],
        },
      }),
      'uploads/upload-1.pdf': '%PDF-1.4 content',
    });
    const file = new File([zipBlob], 'backup.zip', { type: 'application/zip' });

    const db = await createTestDatabase();
    const storage = createMemoryAdapter();

    await importBackup(file, db, storage);

    const uploadDoc = await db.clinical_documents.findOne('upload-1').exec();
    expect(uploadDoc).toBeTruthy();
    expect(uploadDoc?.data_record.resource_type).toBe('uploaded_pdf');

    const storedFile = await storage.read('/uploads/upload-1.pdf');
    expect(storedFile).toBeTruthy();

    await cleanupTestDatabase(db);
  });

  it('rejects invalid ZIP without database.json', async () => {
    const zipBlob = await createTestZip({ 'random.txt': 'not a database' });
    const file = new File([zipBlob], 'bad.zip', { type: 'application/zip' });

    const db = await createTestDatabase();

    await expect(importBackup(file, db, createMemoryAdapter())).rejects.toThrow('missing database.json');

    await cleanupTestDatabase(db);
  });
});
```

#### 5. Orphan Cleanup Tests

```typescript
// apps/web/src/features/upload/services/cleanupOrphans.spec.ts

describe('cleanupOrphanedFiles', () => {
  it('deletes storage files not referenced in DB', async () => {
    const db = await createTestDatabase();
    const storage = createMemoryAdapter();

    // File in storage but not in DB
    await storage.save(createTestFile(), 'orphan-id');

    // File in both storage and DB (upload in clinical_documents)
    const upload = createTestUpload();
    await db.clinical_documents.insert(upload);
    await storage.save(createTestFile(), upload.id);

    await cleanupOrphanedFiles(db, storage);

    const files = await storage.list();
    expect(files).toHaveLength(1);
    expect(files[0]).toContain(upload.id);

    await cleanupTestDatabase(db);
  });

  it('preserves all files when no orphans exist', async () => {
    const db = await createTestDatabase();
    const storage = createMemoryAdapter();

    const upload = createTestUpload();
    await db.clinical_documents.insert(upload);
    await storage.save(createTestFile(), upload.id);

    await cleanupOrphanedFiles(db, storage);

    const files = await storage.list();
    expect(files).toHaveLength(1);

    await cleanupTestDatabase(db);
  });

  it('only considers uploaded documents (resource_type starts with uploaded_)', async () => {
    const db = await createTestDatabase();
    const storage = createMemoryAdapter();

    // Non-upload clinical doc should not affect cleanup
    const clinicalDoc = createTestClinicalDoc();
    await db.clinical_documents.insert(clinicalDoc);

    // Orphan file should still be cleaned up
    await storage.save(createTestFile(), 'orphan-id');

    await cleanupOrphanedFiles(db, storage);

    const files = await storage.list();
    expect(files).toHaveLength(0);

    await cleanupTestDatabase(db);
  });
});
```

### Summary

| Component | Test File | Key Scenarios |
|-----------|-----------|---------------|
| Repository | `ClinicalDocumentRepository.spec.ts` | upload queries, link/unlink, user isolation, not found, type guards |
| Upload Service | `uploadService.spec.ts` | happy path, invalid type, cleanup on failure, pseudo-connection |
| Validation | `uploadValidation.spec.ts` | valid input, missing fields |
| Export/Import | `exportImport.spec.ts` | v1 JSON, v2 ZIP, invalid ZIP, resource_type filtering |
| Orphan Cleanup | `cleanupOrphans.spec.ts` | remove orphans, preserve valid, resource_type filtering |

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
