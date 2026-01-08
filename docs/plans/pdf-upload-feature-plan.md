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

### Embedded Array for Links (No Junction Table)

Store links as an **embedded array** on `user_uploaded_documents`.

**Rationale**:
1. NoSQL-idiomatic pattern
2. RxDB doesn't support atomic transactions across collections
3. Deleting an upload removes all its links automatically

**Note on Array Queries**: RxDB removed support for array field indexes in v12.0.0. Queries on `linked_clinical_document_ids` will perform full collection scans. This is acceptable given expected data volumes.

---

## Data Model

### Schema Design: Aligned with `clinical_documents`

The schema follows the same nested structure as `clinical_documents` for consistency:
- `metadata` object for user-facing display fields (`date`, `display_name`)
- `data_record` object for file/content information (`content_type`, file details)

This alignment makes it easier to:
1. Display both document types uniformly on the timeline
2. Reuse existing timeline components and date formatters
3. Query by `metadata.date` consistently across collections

### New Collection: `user_uploaded_documents`

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.schema.ts

import { RxJsonSchema } from 'rxdb';
import { UserUploadedDocument } from './UserUploadedDocument.type';

export const UserUploadedDocumentSchemaLiteral = {
  title: 'User Uploaded Document Schema',
  description: 'Metadata for documents manually uploaded by the user. File binary stored in OPFS.',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 128,
      description: 'Unique identifier (UUID)',
    },
    user_id: {
      type: 'string',
      maxLength: 128,
      ref: 'user_documents',
      description: 'The user who uploaded this document',
    },
    metadata: {
      type: 'object',
      description: 'User-facing display information (aligned with clinical_documents.metadata)',
      properties: {
        date: {
          type: 'string',
          format: 'date-time',
          maxLength: 128,
          description: 'User-specified effective date (same as clinical_documents.metadata.date)',
        },
        display_name: {
          type: 'string',
          description: 'User-provided name (same as clinical_documents.metadata.display_name)',
        },
      },
    },
    data_record: {
      type: 'object',
      description: 'File content information (aligned with clinical_documents.data_record)',
      properties: {
        content_type: {
          type: 'string',
          maxLength: 128,
          description: 'MIME type (application/pdf, application/dicom, etc.)',
        },
        file_name: {
          type: 'string',
          description: 'Original filename',
        },
        file_size: {
          type: 'number',
          description: 'File size in bytes',
        },
        opfs_path: {
          type: 'string',
          description: 'Path to file in OPFS',
        },
      },
    },
    upload_date: {
      type: 'string',
      format: 'date-time',
      description: 'When the document was uploaded (distinct from metadata.date)',
    },
    linked_clinical_document_ids: {
      type: 'array',
      items: { type: 'string' },
      description: 'IDs of linked clinical documents (not indexed - full scan on query)',
    },
  },
  required: ['id', 'user_id', 'metadata', 'data_record', 'upload_date'],
  indexes: ['user_id', 'metadata.date', 'data_record.content_type'],
} as const;

export const UserUploadedDocumentSchema: RxJsonSchema<UserUploadedDocument> =
  UserUploadedDocumentSchemaLiteral;
```

### TypeScript Interface

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.type.ts

export interface UserUploadedDocument {
  id: string;
  user_id: string;
  metadata: {
    date: string;
    display_name: string;
  };
  data_record: {
    content_type: string;
    file_name: string;
    file_size: number;
    opfs_path: string;
  };
  upload_date: string;
  linked_clinical_document_ids?: string[];
}
```

### Schema Field Mapping Comparison

| Purpose | `clinical_documents` | `user_uploaded_documents` |
|---------|---------------------|---------------------------|
| Timeline date | `metadata.date` | `metadata.date` |
| Display name | `metadata.display_name` | `metadata.display_name` |
| MIME type | `data_record.content_type` | `data_record.content_type` |
| Type classification | `data_record.resource_type` | `data_record.content_type` (filter by PDF/DICOM) |
| Raw data | `data_record.raw` | OPFS via `data_record.opfs_path` |
| User reference | `user_id` | `user_id` |
| Source reference | `connection_record_id` | N/A (user-uploaded) |

### Migration File

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.migration.ts

import { MigrationStrategies } from 'rxdb';

export const UserUploadedDocumentMigrations: MigrationStrategies = {
  // Empty for version 0
};
```

### Collection Export

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.collection.ts

import { RxCollection } from 'rxdb';
import { UserUploadedDocumentSchema } from './UserUploadedDocument.schema';
import { UserUploadedDocument } from './UserUploadedDocument.type';

export { UserUploadedDocumentSchema };
export type UserUploadedDocumentCollection = RxCollection<UserUploadedDocument>;
```

### Register Collection

```typescript
// Update apps/web/src/app/providers/RxDbProvider.tsx

import { UserUploadedDocumentSchema } from '../../models/user-uploaded-document/UserUploadedDocument.collection';
import { UserUploadedDocumentMigrations } from '../../models/user-uploaded-document/UserUploadedDocument.migration';

export const databaseCollections = {
  // ... existing collections
  user_uploaded_documents: {
    schema: UserUploadedDocumentSchema,
    migrationStrategies: UserUploadedDocumentMigrations,
  },
};
```

```typescript
// Update apps/web/src/app/providers/DatabaseCollections.ts

import { UserUploadedDocumentCollection } from '../../models/user-uploaded-document/UserUploadedDocument.collection';

export type DatabaseCollections = {
  // ... existing collections
  user_uploaded_documents: UserUploadedDocumentCollection;
};
```

---

## Query Patterns and Performance

### Expected Query Patterns

| Query | Use Case | Index Used | Performance |
|-------|----------|------------|-------------|
| Get user's uploads sorted by date | Timeline display | `user_id`, `metadata.date` | ✅ Good |
| Filter by content type | Show only PDFs/DICOMs | `data_record.content_type` | ✅ Good |
| Get linked clinical docs FROM upload | View upload detail | Direct ID lookup | ✅ Good |
| Get uploads linked TO clinical doc | View clinical doc detail | **None (full scan)** | ⚠️ O(n) |

### Reverse Lookup Performance Trade-off

The query "find uploads linked to a clinical document" requires a full collection scan because RxDB doesn't support array indexes (removed in v12). This is acceptable because:

1. **Expected volume**: Most users will have < 100 uploaded documents
2. **Query frequency**: Only triggered when viewing a clinical document detail
3. **Alternative complexity**: Maintaining bidirectional links requires manual sync

**If performance becomes an issue**, consider adding `linked_uploaded_document_ids[]` to `clinical_documents` schema (requires migration + sync logic).

---

## Query Hook: `useUserUploadedDocuments`

Encapsulates all query patterns following the existing `useRecordQuery` pattern.

```typescript
// apps/web/src/features/upload/hooks/useUserUploadedDocuments.tsx

import { useCallback, useEffect, useState } from 'react';
import { RxDocument } from 'rxdb';
import { useRxDb } from '../../../app/providers/RxDbProvider';
import { useUser } from '../../../app/providers/UserProvider';
import { UserUploadedDocument } from '../../../models/user-uploaded-document/UserUploadedDocument.type';

type UploadsByDate = Record<string, UserUploadedDocument[]>;

export type UploadQueryStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Hook for querying user uploaded documents.
 * Follows the same pattern as useRecordQuery for clinical documents.
 */
export function useUserUploadedDocuments(): {
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
      const docs = await db.user_uploaded_documents
        .find({
          selector: { user_id: user.id },
          sort: [{ 'metadata.date': 'desc' }],
        })
        .exec();

      // Group by date (same pattern as clinical documents)
      const grouped: UploadsByDate = {};
      for (const doc of docs) {
        const dateKey = doc.metadata.date
          ? doc.metadata.date.split('T')[0]
          : new Date(0).toISOString().split('T')[0];

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(doc.toJSON() as UserUploadedDocument);
      }

      setData(grouped);
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
 * Note: Performs full collection scan (no array index in RxDB).
 */
export function useLinkedUploads(clinicalDocId: string | undefined): {
  uploads: UserUploadedDocument[];
  status: UploadQueryStatus;
} {
  const db = useRxDb();
  const user = useUser();
  const [uploads, setUploads] = useState<UserUploadedDocument[]>([]);
  const [status, setStatus] = useState<UploadQueryStatus>('idle');

  useEffect(() => {
    if (!clinicalDocId) {
      setUploads([]);
      return;
    }

    const fetchLinked = async () => {
      setStatus('loading');
      try {
        // Full scan - filter in memory (RxDB doesn't support array indexes)
        const allUploads = await db.user_uploaded_documents
          .find({ selector: { user_id: user.id } })
          .exec();

        const linked = allUploads
          .filter((doc) =>
            doc.linked_clinical_document_ids?.includes(clinicalDocId)
          )
          .map((doc) => doc.toJSON() as UserUploadedDocument);

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
 * Direct ID lookup - efficient.
 */
export function useLinkedClinicalDocs(uploadedDoc: UserUploadedDocument | undefined): {
  clinicalDocs: any[]; // ClinicalDocument type
  status: UploadQueryStatus;
} {
  const db = useRxDb();
  const [clinicalDocs, setClinicalDocs] = useState<any[]>([]);
  const [status, setStatus] = useState<UploadQueryStatus>('idle');

  useEffect(() => {
    if (!uploadedDoc?.linked_clinical_document_ids?.length) {
      setClinicalDocs([]);
      return;
    }

    const fetchLinked = async () => {
      setStatus('loading');
      try {
        const docs = await db.clinical_documents
          .find({
            selector: {
              id: { $in: uploadedDoc.linked_clinical_document_ids },
            },
          })
          .exec();

        setClinicalDocs(docs.map((d) => d.toJSON()));
        setStatus('success');
      } catch (error) {
        console.error('Failed to fetch linked clinical docs:', error);
        setStatus('error');
      }
    };

    fetchLinked();
  }, [db, uploadedDoc?.linked_clinical_document_ids]);

  return { clinicalDocs, status };
}
```

### Hook Usage Examples

```typescript
// Timeline: show all uploads grouped by date
function UploadTimeline() {
  const { data, status } = useUserUploadedDocuments();
  // data is Record<string, UserUploadedDocument[]> grouped by date
}

// Clinical document detail: show linked uploads
function ClinicalDocDetail({ docId }: { docId: string }) {
  const { uploads, status } = useLinkedUploads(docId);
  // uploads is UserUploadedDocument[] linked to this clinical doc
}

// Upload detail: show linked clinical documents
function UploadDetail({ upload }: { upload: UserUploadedDocument }) {
  const { clinicalDocs, status } = useLinkedClinicalDocs(upload);
  // clinicalDocs is ClinicalDocument[] this upload links to
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

Uses existing utilities: `uuid4()` from `UUIDUtils.ts`, `getFileFromFileList()` from `FileUtils.ts`.

```typescript
// apps/web/src/features/upload/services/uploadDocument.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { UserUploadedDocument } from '../../../models/user-uploaded-document/UserUploadedDocument.type';
import uuid4 from '../../../shared/utils/UUIDUtils';
import { checkOPFSSupport, saveFileToOPFS, deleteFileFromOPFS } from './opfsStorage';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const SUPPORTED_TYPES = ['application/pdf'];

export class UploadError extends Error {
  constructor(
    message: string,
    public code: 'UNSUPPORTED_BROWSER' | 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR'
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export async function uploadDocument(
  db: RxDatabase<DatabaseCollections>,
  file: File,
  userId: string,
  displayName: string,
  documentDate: string
): Promise<UserUploadedDocument> {
  // 1. Check browser support
  if (!checkOPFSSupport()) {
    throw new UploadError(
      'Your browser does not support file uploads. Please use Chrome 86+, Edge 86+, Safari 15.2+, or Firefox 111+.',
      'UNSUPPORTED_BROWSER'
    );
  }

  // 2. Validate file type
  if (!SUPPORTED_TYPES.includes(file.type)) {
    throw new UploadError(
      `File type "${file.type}" is not supported. Please upload a PDF file.`,
      'INVALID_TYPE'
    );
  }

  // 3. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError(
      `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      'FILE_TOO_LARGE'
    );
  }

  // 4. Check storage quota
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.usage && estimate.quota) {
      const availableSpace = estimate.quota - estimate.usage;
      if (file.size > availableSpace * 0.9) {
        throw new UploadError(
          'Not enough storage space. Please free up space or export your data.',
          'QUOTA_EXCEEDED'
        );
      }
    }
  } catch (e) {
    if (e instanceof UploadError) throw e;
    // Quota check failed, continue anyway
  }

  // 5. Generate ID and save to OPFS
  const id = uuid4();
  let opfsPath: string | null = null;

  try {
    opfsPath = await saveFileToOPFS(file, id);

    // 6. Create metadata record (aligned with clinical_documents structure)
    const doc = await db.user_uploaded_documents.insert({
      id,
      user_id: userId,
      metadata: {
        date: documentDate,
        display_name: displayName,
      },
      data_record: {
        content_type: file.type,
        file_name: file.name,
        file_size: file.size,
        opfs_path: opfsPath,
      },
      upload_date: new Date().toISOString(),
      linked_clinical_document_ids: [],
    });

    return doc.toJSON() as UserUploadedDocument;
  } catch (error) {
    // Cleanup OPFS if IndexedDB insert failed
    if (opfsPath) {
      await deleteFileFromOPFS(opfsPath);
    }
    throw new UploadError('Failed to save document. Please try again.', 'STORAGE_ERROR');
  }
}

export async function deleteUploadedDocument(
  db: RxDatabase<DatabaseCollections>,
  documentId: string
): Promise<void> {
  const doc = await db.user_uploaded_documents.findOne(documentId).exec();
  if (!doc) return;

  const opfsPath = doc.data_record.opfs_path;

  // Delete from IndexedDB first
  await doc.remove();

  // Then delete from OPFS
  await deleteFileFromOPFS(opfsPath);
}
```

---

## Export/Import Integration

### New Dependency

Add JSZip for client-side ZIP handling:
```bash
npm install jszip
npm install -D @types/jszip
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

import JSZip from 'jszip';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { readFileFromOPFS } from './opfsStorage';

/**
 * Export database and uploaded files as a ZIP
 */
export async function exportAsZip(
  db: RxDatabase<DatabaseCollections>
): Promise<Blob> {
  const zip = new JSZip();

  // 1. Export RxDB data as JSON
  const dbExport = await db.exportJSON();
  zip.file('database.json', JSON.stringify(dbExport, null, 2));

  // 2. Add OPFS files to uploads/ folder
  const uploads = await db.user_uploaded_documents?.find().exec() || [];
  const uploadsFolder = zip.folder('uploads');

  for (const upload of uploads) {
    const file = await readFileFromOPFS(upload.data_record.opfs_path);
    if (file && uploadsFolder) {
      // Get filename from opfs_path (e.g., "/uploads/uuid.pdf" -> "uuid.pdf")
      const fileName = upload.data_record.opfs_path.split('/').pop() || `${upload.id}.pdf`;
      uploadsFolder.file(fileName, file);
    }
  }

  // 3. Generate ZIP blob
  return zip.generateAsync({ type: 'blob' });
}
```

### Import Service

```typescript
// apps/web/src/features/upload/services/importService.ts

import JSZip from 'jszip';
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
  const zip = await JSZip.loadAsync(file);

  // 1. Extract and parse database.json
  const dbFile = zip.file('database.json');
  if (!dbFile) {
    throw new Error('Invalid backup: missing database.json');
  }
  const dbJsonString = await dbFile.async('string');
  const dbData = JSON.parse(dbJsonString);

  // 2. Import RxDB data
  await Promise.all(Object.values(db.collections).map((col) => col?.remove()));
  await db.addCollections<DatabaseCollections>(databaseCollections);

  const importResult = await db.importJSON(dbData);
  // ... handle errors from importResult ...

  // 3. Restore OPFS files
  if (checkOPFSSupport()) {
    const uploadDocs = await db.user_uploaded_documents?.find().exec() || [];
    const uploadsFolder = zip.folder('uploads');

    if (uploadsFolder) {
      for (const doc of uploadDocs) {
        // Get filename from opfs_path
        const fileName = doc.data_record.opfs_path.split('/').pop();
        if (!fileName) continue;

        const zipFile = uploadsFolder.file(fileName);
        if (zipFile) {
          const blob = await zipFile.async('blob');
          const restoredFile = new File([blob], doc.data_record.file_name, {
            type: doc.data_record.content_type,
          });
          await saveFileToOPFS(restoredFile, doc.id);
        }
      }
    }
  }

  return `Successfully imported backup with ${uploadDocs?.length || 0} uploaded files`;
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

  const importResult = await db.importJSON(dbData);
  // ... handle errors from importResult ...

  return 'Successfully imported backup';
}
```

### Updated UserDataSettingsGroup.tsx

```typescript
// Modify apps/web/src/features/settings/components/UserDataSettingsGroup.tsx

import { exportAsZip } from '../../upload/services/exportService';
import { importBackup } from '../../upload/services/importService';

// Export handler
export const exportData = async (
  db: RxDatabase<DatabaseCollections>,
  setFileDownloadLink: (blob: string) => void,
) => {
  // Check if user has uploaded documents
  const uploads = await db.user_uploaded_documents?.find().exec() || [];

  if (uploads.length > 0) {
    // v2: Export as ZIP with uploaded files
    const zipBlob = await exportAsZip(db);
    const blobUrl = URL.createObjectURL(zipBlob);
    setFileDownloadLink(blobUrl);
    return blobUrl;
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
  displayName: yup
    .string()
    .required('Display name is required')
    .max(255, 'Display name must be less than 255 characters'),
  documentDate: yup
    .date()
    .required('Document date is required')
    .max(new Date(), 'Document date cannot be in the future'),
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
import { uploadDocument, UploadError } from '../services/uploadDocument';
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

## Link Service

```typescript
// apps/web/src/features/upload/services/linkDocument.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { UserUploadedDocument } from '../../../models/user-uploaded-document/UserUploadedDocument.type';

export async function linkToClinicalDocument(
  db: RxDatabase<DatabaseCollections>,
  uploadedDocId: string,
  clinicalDocId: string
): Promise<void> {
  const doc = await db.user_uploaded_documents.findOne(uploadedDocId).exec();
  if (!doc) throw new Error('Uploaded document not found');

  const currentLinks = doc.linked_clinical_document_ids || [];
  if (currentLinks.includes(clinicalDocId)) return;

  await doc.update({
    $set: {
      linked_clinical_document_ids: [...currentLinks, clinicalDocId],
    },
  });
}

export async function unlinkFromClinicalDocument(
  db: RxDatabase<DatabaseCollections>,
  uploadedDocId: string,
  clinicalDocId: string
): Promise<void> {
  const doc = await db.user_uploaded_documents.findOne(uploadedDocId).exec();
  if (!doc) return;

  const currentLinks = doc.linked_clinical_document_ids || [];
  await doc.update({
    $set: {
      linked_clinical_document_ids: currentLinks.filter((id) => id !== clinicalDocId),
    },
  });
}

/**
 * Get all uploaded documents linked to a clinical document.
 * Note: Performs full collection scan (RxDB doesn't support array indexes).
 */
export async function getLinkedUploads(
  db: RxDatabase<DatabaseCollections>,
  clinicalDocId: string
): Promise<UserUploadedDocument[]> {
  const allUploads = await db.user_uploaded_documents.find().exec();
  return allUploads
    .filter((doc) => doc.linked_clinical_document_ids?.includes(clinicalDocId))
    .map((doc) => doc.toJSON() as UserUploadedDocument);
}
```

---

## Orphan Cleanup

Run on app initialization to clean up orphaned OPFS files.

```typescript
// apps/web/src/features/upload/services/cleanupOrphans.ts

import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { checkOPFSSupport, initOPFS } from './opfsStorage';

export async function cleanupOrphanedFiles(
  db: RxDatabase<DatabaseCollections>
): Promise<void> {
  if (!checkOPFSSupport()) return;

  try {
    const uploadsDir = await initOPFS();
    const dbDocs = await db.user_uploaded_documents?.find().exec() || [];
    const dbPaths = new Set(dbDocs.map((d) => d.data_record.opfs_path));

    for await (const entry of uploadsDir.values()) {
      if (entry.kind === 'file') {
        const opfsPath = `/uploads/${entry.name}`;
        if (!dbPaths.has(opfsPath)) {
          console.warn(`Cleaning up orphaned file: ${opfsPath}`);
          await uploadsDir.removeEntry(entry.name);
        }
      }
    }
  } catch (error) {
    console.error('Error during orphan cleanup:', error);
  }
}
```

---

## Error Handling Summary

| Error | User Message | Code |
|-------|--------------|------|
| Browser doesn't support OPFS | "Your browser does not support file uploads. Please use Chrome 86+, Edge 86+, Safari 15.2+, or Firefox 111+." | `UNSUPPORTED_BROWSER` |
| Invalid file type | "File type X is not supported. Please upload a PDF file." | `INVALID_TYPE` |
| File too large | "File size exceeds maximum of 200MB." | `FILE_TOO_LARGE` |
| Storage quota exceeded | "Not enough storage space. Please free up space or export your data." | `QUOTA_EXCEEDED` |
| Storage write failed | "Failed to save document. Please try again." | `STORAGE_ERROR` |

---

## File Structure

```
apps/web/src/
├── models/
│   └── user-uploaded-document/
│       ├── UserUploadedDocument.schema.ts
│       ├── UserUploadedDocument.type.ts
│       ├── UserUploadedDocument.collection.ts
│       └── UserUploadedDocument.migration.ts
│
├── features/
│   ├── upload/
│   │   ├── components/
│   │   │   ├── UploadDocumentModal.tsx
│   │   │   └── uploadValidation.ts
│   │   └── services/
│   │       ├── opfsStorage.ts
│   │       ├── uploadDocument.ts
│   │       ├── linkDocument.ts
│   │       ├── exportService.ts       # ZIP export
│   │       ├── importService.ts       # ZIP/JSON import
│   │       └── cleanupOrphans.ts
│   │
│   ├── settings/components/
│   │   └── UserDataSettingsGroup.tsx  (modified for export/import)
│   │
│   └── timeline/
│       ├── components/
│       │   ├── cards/
│       │   │   └── UserUploadedDocumentCard.tsx
│       │   ├── expandables/
│       │   │   └── ShowUserUploadedDocumentExpandable.tsx
│       │   ├── layout/
│       │   │   └── TimelineItem.tsx  (modified)
│       │   └── LinkDocumentModal.tsx
│       └── hooks/
│           └── useUserUploadedDocuments.ts
│
└── app/providers/
    ├── RxDbProvider.tsx       (modified for import)
    └── DatabaseCollections.ts (modified)
```

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
