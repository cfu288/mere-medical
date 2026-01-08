# PDF Upload Feature Implementation Plan

## Overview

This plan addresses [Issue #221](https://github.com/cfu288/mere-medical/issues/221) - adding manual data input capability, specifically the ability to upload PDF documents and optionally link them to existing medical records.

## Problem Statement

Users who have medical records from providers not covered by supported integrations (Epic, Cerner, Veradigm, etc.) need a way to manually upload documents like PDFs of lab results, imaging reports, or historical medical records.

## Requirements

1. Users can upload PDF documents (future: DICOM and other large files)
2. At upload, user provides: **display name** and **effective date** (document date)
3. Uploaded PDFs appear as **independent items** on the timeline, sorted by effective date
4. From existing timeline cards, users can **link uploaded documents** via search
5. One clinical document can link to multiple uploaded documents
6. One uploaded document can be linked from multiple clinical documents

---

## Architecture Considerations

### Current Architecture

- **Offline-First**: All data stored client-side in IndexedDB via RxDB
- **No Backend Database**: The NestJS backend only handles OAuth flows and proxying
- **Encryption**: Data can be optionally encrypted using a user-provided password (SylvieJS)
- **Existing Pattern**: PDFs from FHIR servers are stored as base64 strings in `clinical_documents` with `resource_type: 'documentreference_attachment'`

### Design Decision: OPFS for File Storage

Store uploaded files in **OPFS (Origin Private File System)** rather than base64 in IndexedDB.

**Rationale**:
1. **Large file support**: DICOM and medical imaging files can be hundreds of MB
2. **No encoding overhead**: Binary files stored natively (no 33% base64 bloat)
3. **Better performance**: Large files don't impact RxDB query performance
4. **Streaming support**: Can read files without loading entirely into memory
5. **No per-record limits**: OPFS handles large files better than IndexedDB

**Trade-offs**:
1. **Encryption**: Must handle separately (not automatic like SylvieJS)
2. **Backup/Export**: Need custom logic to include OPFS files
3. **Complexity**: Two storage systems to coordinate
4. **Data integrity**: Must keep IndexedDB refs and OPFS files in sync

### Design Decision: Embedded Array for Links (No Junction Table)

Store links as an **embedded array** on `user_uploaded_documents` rather than a separate junction collection.

**Rationale**:
1. **NoSQL pattern**: Embedding is idiomatic for document databases
2. **Non-atomic writes**: RxDB doesn't support atomic transactions across collections - a junction table could result in orphaned records if writes fail
3. **Simpler deletion**: Deleting an upload removes all its links automatically
4. **Single query**: Find linked uploads with one query instead of join

**Trade-off**:
- Querying "all uploads linked to clinical doc X" requires scanning the array field
- Acceptable given expected data volumes (users won't have thousands of uploads)

### Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Storage                       │
├─────────────────────────┬───────────────────────────────┤
│      IndexedDB (RxDB)   │         OPFS                  │
│                         │                               │
│  user_uploaded_documents│  /uploads/                    │
│  ┌───────────────────┐  │  ├── {uuid1}.pdf              │
│  │ id: uuid1         │  │  ├── {uuid2}.pdf              │
│  │ opfs_path: /upl...│──┼──├── {uuid3}.dcm  (future)    │
│  │ content_type: ... │  │  └── ...                      │
│  │ display_name: ... │  │                               │
│  │ linked_to: [...]  │  │                               │
│  └───────────────────┘  │                               │
└─────────────────────────┴───────────────────────────────┘
```

---

## Data Model Design

### New Collection: `user_uploaded_documents`

#### Schema Definition

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.schema.ts

export const userUploadedDocumentSchemaLiteral = {
  title: 'User Uploaded Document Schema',
  name: 'user_uploaded_documents',
  description: 'Metadata for documents manually uploaded by the user. File binary stored in OPFS.',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      maxLength: 128,
      description: 'Unique identifier for the uploaded document',
    },
    user_id: {
      type: 'string',
      format: 'uuid',
      maxLength: 128,
      ref: 'user_documents',
      description: 'The user who uploaded this document',
    },
    file_name: {
      type: 'string',
      maxLength: 255,
      description: 'Original filename of the uploaded document',
    },
    file_size: {
      type: 'number',
      description: 'File size in bytes',
    },
    content_type: {
      type: 'string',
      maxLength: 128,
      description: 'MIME type (e.g., application/pdf, application/dicom, image/jpeg)',
    },
    opfs_path: {
      type: 'string',
      maxLength: 512,
      description: 'Path to the file in OPFS (e.g., /uploads/{uuid}.pdf)',
    },
    upload_date: {
      type: 'string',
      format: 'date-time',
      maxLength: 128,
      description: 'ISO 8601 timestamp of when the document was uploaded',
    },
    document_date: {
      type: 'string',
      format: 'date-time',
      maxLength: 128,
      description: 'User-specified effective date of the document',
    },
    display_name: {
      type: 'string',
      maxLength: 255,
      description: 'User-provided name for the document',
    },
    linked_clinical_document_ids: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 128,
      },
      description: 'Array of clinical_documents IDs this upload is linked to',
    },
  },
  required: ['id', 'user_id', 'file_name', 'file_size', 'content_type', 'opfs_path', 'upload_date', 'document_date', 'display_name'],
  indexes: [
    'user_id',
    'document_date',
    'upload_date',
    'content_type',
  ],
} as const;
```

#### TypeScript Interface

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.type.ts

export interface UserUploadedDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  content_type: string;  // MIME type: 'application/pdf', 'application/dicom', etc.
  opfs_path: string;     // Path in OPFS: '/uploads/{uuid}.pdf'
  upload_date: string;
  document_date: string;
  display_name: string;
  linked_clinical_document_ids?: string[];  // IDs of linked clinical documents
}

export type CreateUserUploadedDocument = Omit<UserUploadedDocument, 'id'>;
```

---

## OPFS Implementation

### OPFS Service

```typescript
// apps/web/src/features/upload/services/opfsStorage.ts

const UPLOADS_DIR = 'uploads';

/**
 * Initialize OPFS directory structure
 */
export async function initOPFS(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const uploadsDir = await root.getDirectoryHandle(UPLOADS_DIR, { create: true });
  return uploadsDir;
}

/**
 * Save a file to OPFS
 * @returns The OPFS path where the file was saved
 */
export async function saveFileToOPFS(
  file: File,
  documentId: string
): Promise<string> {
  const uploadsDir = await initOPFS();
  const extension = getFileExtension(file.name);
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
 * @returns File object or null if not found
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
    return await fileHandle.getFile();
  } catch (error) {
    console.error('Error reading file from OPFS:', error);
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
  } catch (error) {
    console.error('Error deleting file from OPFS:', error);
  }
}

/**
 * Get a blob URL for displaying a file
 */
export async function getFileUrl(opfsPath: string): Promise<string | null> {
  const file = await readFileFromOPFS(opfsPath);
  if (!file) return null;
  return URL.createObjectURL(file);
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot !== -1 ? fileName.substring(lastDot) : '';
}
```

### Supported Content Types

For MVP, only PDF is supported. Schema allows future expansion:

| Content Type | Extension | Status |
|--------------|-----------|--------|
| `application/pdf` | `.pdf` | MVP |
| `application/dicom` | `.dcm` | Future |
| `image/jpeg` | `.jpg`, `.jpeg` | Future |
| `image/png` | `.png` | Future |

---

## Linking Strategy: Embedded Array

Links are stored as an array of clinical document IDs on the uploaded document.

### Link Operations

```typescript
// apps/web/src/features/upload/services/linkDocument.ts

/**
 * Link an uploaded document to a clinical document
 */
export async function linkToClinicalDocument(
  db: RxDatabase<DatabaseCollections>,
  uploadedDocId: string,
  clinicalDocId: string
): Promise<void> {
  const doc = await db.user_uploaded_documents.findOne(uploadedDocId).exec();
  if (!doc) throw new Error('Uploaded document not found');

  const currentLinks = doc.linked_clinical_document_ids || [];
  if (currentLinks.includes(clinicalDocId)) return; // Already linked

  await doc.update({
    $set: {
      linked_clinical_document_ids: [...currentLinks, clinicalDocId],
    },
  });
}

/**
 * Unlink an uploaded document from a clinical document
 */
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
      linked_clinical_document_ids: currentLinks.filter(id => id !== clinicalDocId),
    },
  });
}

/**
 * Get all uploaded documents linked to a clinical document
 */
export async function getLinkedUploads(
  db: RxDatabase<DatabaseCollections>,
  clinicalDocId: string
): Promise<UserUploadedDocument[]> {
  const results = await db.user_uploaded_documents
    .find({
      selector: {
        linked_clinical_document_ids: {
          $elemMatch: clinicalDocId,
        },
      },
    })
    .exec();

  return results.map(doc => doc.toJSON());
}
```

---

## Foreign Key Relationships

### Entity Relationship Diagram

```
┌─────────────────────┐
│   user_documents    │
│─────────────────────│
│ id (PK)             │◄─────────────────────────────────┐
│ first_name          │                                  │
│ last_name           │                                  │
│ ...                 │                                  │
└─────────────────────┘                                  │
         ▲                                               │
         │                                               │
         │ user_id (FK)                                  │
         │                                               │
┌────────┴────────────────┐                              │
│ user_uploaded_documents │                              │
│─────────────────────────│                              │
│ id (PK, UUID)           │                              │
│ user_id (FK) ───────────┼──────────────────────────────┘
│ file_name               │
│ content_type            │
│ opfs_path ──────────────┼── OPFS
│ document_date           │
│ display_name            │
│ linked_clinical_doc_ids │──────────┐
└─────────────────────────┘          │
                                     │ Array of IDs (embedded)
                                     ▼
                  ┌─────────────────────────┐
                  │   clinical_documents    │
                  │─────────────────────────│
                  │ id (PK, composite)      │
                  │ user_id (FK)            │
                  │ connection_record_id    │
                  │ data_record             │
                  │ metadata                │
                  └─────────────────────────┘
```

### Relationship Summary

| From | Field | To | Type |
|------|-------|-----|------|
| `user_uploaded_documents` | `user_id` | `user_documents.id` | Many-to-One |
| `user_uploaded_documents` | `opfs_path` | OPFS file system | Reference |
| `user_uploaded_documents` | `linked_clinical_document_ids[]` | `clinical_documents.id` | Many-to-Many (embedded) |

---

## User Workflows

### Workflow 1: Upload a PDF

```
User clicks "Upload" button in Timeline
    │
    ▼
Upload modal opens
    │
    ├── User selects PDF file
    ├── User enters display name (required)
    └── User selects effective date (required)
    │
    ▼
User clicks "Upload"
    │
    ├── 1. Generate UUID for document
    ├── 2. Save file to OPFS: /uploads/{uuid}.pdf
    ├── 3. Create metadata record in user_uploaded_documents
    └── 4. Record contains opfs_path reference
    │
    ▼
Document appears on timeline at effective date
```

### Workflow 2: Link Uploaded Document to Clinical Card

```
User views a clinical card (e.g., Lab Results)
    │
    ▼
User clicks "Link Document" action
    │
    ▼
Search modal opens showing user's uploaded documents
    │
    ├── User searches by display name
    └── User selects one or more documents
    │
    ▼
User clicks "Link"
    │
    ▼
Each selected upload's linked_clinical_document_ids array updated
    │
    ▼
Clinical card now shows linked documents
```

### Workflow 3: View Uploaded Document

```
User clicks on uploaded document card
    │
    ▼
System reads opfs_path from metadata
    │
    ▼
System fetches file from OPFS
    │
    ▼
System creates blob URL
    │
    ▼
PDF displayed in iframe viewer
```

---

## Timeline Display

### Default View: Independent Items

Uploaded documents appear as **standalone cards** on the timeline, sorted by `document_date`:

```
Timeline:
├── Jan 20 - [Upload] Blood Work Scan          ← Uploaded PDF
├── Jan 15 - Lab Results (from Epic)           ← Clinical document
├── Jan 15 - [Upload] Lab Report Addendum      ← Uploaded PDF
├── Jan 10 - Immunization (from Cerner)        ← Clinical document
```

### Expanded Clinical Card: Shows Links

When a clinical card is expanded, it shows any linked uploaded documents:

```
┌─────────────────────────────────────────┐
│ Lab Results - Jan 15                    │
│ Source: Epic MyChart                    │
│                                         │
│ [Lab result details...]                 │
│                                         │
│ ─────────────────────────────────────── │
│ Linked Documents:                       │
│   • Lab Report Addendum (Jan 15)  [×]   │
│   • Doctor Notes Scan (Jan 14)    [×]   │
│                                         │
│ [+ Link Document]                       │
└─────────────────────────────────────────┘
```

---

## Storage Considerations

### OPFS Benefits

| Aspect | OPFS Approach |
|--------|---------------|
| Storage overhead | None (native binary) |
| Large file support | Excellent (streaming) |
| Query performance | Unaffected (metadata only in RxDB) |
| Memory usage | Low (files loaded on demand) |

### File Size Limits

| Constraint | Value |
|------------|-------|
| Per-file limit | 200 MB (can increase for DICOM) |
| Warning threshold | Show warning when storage > 80% |

### Browser Support

OPFS is supported in:
- Chrome 86+
- Edge 86+
- Safari 15.2+
- Firefox 111+

For unsupported browsers, show an error message indicating the feature requires a modern browser.

---

## Backup & Export Considerations

Since OPFS files are separate from IndexedDB, backup/export needs special handling:

### Export Strategy

```typescript
export async function exportWithUploads(
  db: RxDatabase<DatabaseCollections>
): Promise<Blob> {
  // 1. Export RxDB data as JSON
  const dbExport = await db.exportJSON();

  // 2. Get all uploaded document metadata
  const uploads = await db.user_uploaded_documents.find().exec();

  // 3. Read each file from OPFS and include as base64 in export
  const filesData = await Promise.all(
    uploads.map(async (doc) => {
      const file = await readFileFromOPFS(doc.opfs_path);
      if (!file) return null;
      const base64 = await fileToBase64(file);
      return { id: doc.id, data: base64 };
    })
  );

  // 4. Create combined export object
  const fullExport = {
    database: dbExport,
    uploadedFiles: filesData.filter(Boolean),
  };

  return new Blob([JSON.stringify(fullExport)], { type: 'application/json' });
}
```

### Import Strategy

```typescript
export async function importWithUploads(
  db: RxDatabase<DatabaseCollections>,
  exportData: { database: any; uploadedFiles: { id: string; data: string }[] }
): Promise<void> {
  // 1. Import RxDB data
  await db.importJSON(exportData.database);

  // 2. Restore files to OPFS
  for (const fileData of exportData.uploadedFiles) {
    const doc = await db.user_uploaded_documents.findOne(fileData.id).exec();
    if (doc) {
      const blob = base64ToBlob(fileData.data, doc.content_type);
      const file = new File([blob], doc.file_name, { type: doc.content_type });
      await saveFileToOPFS(file, doc.id);
    }
  }
}
```

---

## Implementation Steps

### Phase 1: Data Layer

#### Step 1.1: Create UserUploadedDocument Model

Create files in `apps/web/src/models/user-uploaded-document/`:
- `UserUploadedDocument.schema.ts`
- `UserUploadedDocument.type.ts`
- `UserUploadedDocument.collection.ts`
- `UserUploadedDocument.migration.ts`

#### Step 1.2: Register Collection

Update `apps/web/src/app/providers/RxDbProvider.tsx` and `DatabaseCollections.ts`.

### Phase 2: OPFS Storage Layer

#### Step 2.1: Create OPFS Service

Create `apps/web/src/features/upload/services/opfsStorage.ts`:
- `initOPFS()` - Initialize directory structure
- `saveFileToOPFS()` - Save file, return path
- `readFileFromOPFS()` - Read file by path
- `deleteFileFromOPFS()` - Delete file
- `getFileUrl()` - Get blob URL for display

#### Step 2.2: Create Upload Service

Create `apps/web/src/features/upload/services/uploadDocument.ts`:

```typescript
export async function uploadDocument(
  db: RxDatabase<DatabaseCollections>,
  file: File,
  userId: string,
  displayName: string,
  documentDate: string
): Promise<UserUploadedDocument> {
  // 1. Validate file type (PDF only for MVP)
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are supported');
  }

  // 2. Validate file size (< 200MB)
  if (file.size > 200 * 1024 * 1024) {
    throw new Error('File size must be less than 200MB');
  }

  // 3. Generate UUID
  const id = crypto.randomUUID();

  // 4. Save to OPFS
  const opfsPath = await saveFileToOPFS(file, id);

  // 5. Create metadata record
  const doc = await db.user_uploaded_documents.insert({
    id,
    user_id: userId,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type,
    opfs_path: opfsPath,
    upload_date: new Date().toISOString(),
    document_date: documentDate,
    display_name: displayName,
    linked_clinical_document_ids: [],
  });

  return doc.toJSON();
}
```

### Phase 3: Upload UI

#### Step 3.1: Create Upload Modal

Create `apps/web/src/features/upload/components/UploadDocumentModal.tsx`:
- File input (accept: `.pdf`)
- Display name input (required)
- Document date picker (required)
- File size validation
- Upload progress indicator
- Error handling

### Phase 4: Timeline Integration

#### Step 4.1: Query Hook

Create `apps/web/src/features/timeline/hooks/useUserUploadedDocuments.ts`

#### Step 4.2: Upload Card Component

Create `apps/web/src/features/timeline/components/cards/UserUploadedDocumentCard.tsx`

#### Step 4.3: Expandable Viewer

Create `apps/web/src/features/timeline/components/expandables/ShowUserUploadedDocumentExpandable.tsx`:
- Fetch file from OPFS via `opfs_path`
- Create blob URL
- Display in iframe

#### Step 4.4: Update TimelineItem

Modify `TimelineItem.tsx` to render uploaded document cards.

### Phase 5: Linking Feature

#### Step 5.1: Link Service

Create `apps/web/src/features/upload/services/linkDocument.ts`:
- `linkToClinicalDocument()` - Add clinical doc ID to array
- `unlinkFromClinicalDocument()` - Remove clinical doc ID from array
- `getLinkedUploads()` - Query uploads linked to a clinical doc

#### Step 5.2: Link Document Modal

Create `apps/web/src/features/timeline/components/LinkDocumentModal.tsx`:
- Search input to filter uploaded documents by display name
- List of matching uploaded documents
- Checkbox selection for multiple links
- "Link" button

#### Step 5.3: Update Clinical Card Expandables

Add "Linked Documents" section and "Link Document" button to existing expandables.

### Phase 6: Backup/Export Update

#### Step 6.1: Update Export Function

Modify backup export to include OPFS files (converted to base64 for portability).

#### Step 6.2: Update Import Function

Modify backup import to restore OPFS files from base64.

---

## File Structure Summary

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
│   │   │   └── UploadDocumentModal.tsx
│   │   ├── hooks/
│   │   │   └── useUploadDocument.ts
│   │   └── services/
│   │       ├── opfsStorage.ts          # OPFS operations
│   │       ├── uploadDocument.ts       # Upload orchestration
│   │       └── linkDocument.ts         # Link/unlink operations
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
└── app/
    └── providers/
        ├── RxDbProvider.tsx      (modified)
        └── DatabaseCollections.ts (modified)
```

---

## No Backend Changes Required

The feature is entirely client-side:
- Metadata stored in browser IndexedDB (RxDB)
- Files stored in browser OPFS
- No server-side storage needed

---

## Testing Strategy

### Unit Tests
- Schema validation
- OPFS service functions
- File type validation
- File size validation
- Link/unlink array operations

### Integration Tests
- Upload flow: file → OPFS + metadata
- Read flow: metadata → OPFS → display
- Delete flow: remove metadata + OPFS file
- Link/unlink flow: array updates
- Backup/restore with uploaded files

### E2E Tests (Playwright)
- Upload a PDF with display name and date
- Verify PDF appears on timeline
- Open and view PDF
- Link uploaded document from clinical card
- Unlink document
- Delete uploaded document
- Export and import with uploads

---

## Success Metrics

- Users can upload PDF files up to 200MB
- Upload requires display name and effective date
- Uploaded documents appear on timeline at effective date
- Files stored in OPFS (not base64 in IndexedDB)
- Users can link uploaded docs to clinical cards via search
- Linked documents display on clinical card when expanded
- Documents persist across browser sessions
- Documents included in backup exports (converted to base64 for portability)
- Works with modern browsers (Chrome 86+, Edge 86+, Safari 15.2+, Firefox 111+)
