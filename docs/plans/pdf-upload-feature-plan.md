# PDF Upload Feature Implementation Plan

## Overview

This plan addresses [Issue #221](https://github.com/cfu288/mere-medical/issues/221) - adding manual data input capability, specifically the ability to upload PDF documents and optionally link them to existing medical records.

## Problem Statement

Users who have medical records from providers not covered by supported integrations (Epic, Cerner, Veradigm, etc.) need a way to manually upload documents like PDFs of lab results, imaging reports, or historical medical records.

## Requirements

1. Users can upload PDF documents
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

### Design Decision: New Collection

Create a **new `user_uploaded_documents` collection** rather than reusing `clinical_documents`.

**Rationale**:
1. `clinical_documents` requires a `connection_record_id` (foreign key to a FHIR connection) which user uploads don't have
2. The primary key is composite: `connection_record_id|user_id|metadata.id` - not suitable for user uploads
3. Separating user-uploaded content from synced FHIR data maintains data integrity
4. Cleaner data management and querying

---

## Data Model Design

### New Collection: `user_uploaded_documents`

#### Schema Definition

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.schema.ts

export const userUploadedDocumentSchemaLiteral = {
  title: 'User Uploaded Document Schema',
  name: 'user_uploaded_documents',
  description: 'Documents manually uploaded by the user (PDFs, images, etc.)',
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
      description: 'MIME type (e.g., application/pdf, image/jpeg)',
    },
    data: {
      type: 'string',
      description: 'Base64-encoded file content',
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
  },
  required: ['id', 'user_id', 'file_name', 'content_type', 'data', 'upload_date', 'document_date', 'display_name'],
  indexes: [
    'user_id',
    'document_date',
    'upload_date',
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
  content_type: string;
  data: string;  // Base64-encoded
  upload_date: string;
  document_date: string;
  display_name: string;
}

export type CreateUserUploadedDocument = Omit<UserUploadedDocument, 'id'>;
```

---

## Linking Strategy: Junction Collection

To support many-to-many linking between clinical documents and uploaded documents, create a **junction collection**.

### New Collection: `clinical_document_links`

```typescript
// apps/web/src/models/clinical-document-link/ClinicalDocumentLink.schema.ts

export const clinicalDocumentLinkSchemaLiteral = {
  title: 'Clinical Document Link Schema',
  name: 'clinical_document_links',
  description: 'Links between clinical documents and user-uploaded documents',
  version: 0,
  primaryKey: {
    key: 'id',
    fields: ['clinical_document_id', 'uploaded_document_id'],
    separator: '|',
  },
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 256,
      description: 'Composite key: clinical_document_id|uploaded_document_id',
    },
    clinical_document_id: {
      type: 'string',
      maxLength: 128,
      ref: 'clinical_documents',
      description: 'The clinical document being linked from',
    },
    uploaded_document_id: {
      type: 'string',
      format: 'uuid',
      maxLength: 128,
      ref: 'user_uploaded_documents',
      description: 'The uploaded document being linked to',
    },
    user_id: {
      type: 'string',
      format: 'uuid',
      maxLength: 128,
      ref: 'user_documents',
      description: 'The user who created this link',
    },
    created_at: {
      type: 'string',
      format: 'date-time',
      maxLength: 128,
      description: 'When the link was created',
    },
  },
  required: ['id', 'clinical_document_id', 'uploaded_document_id', 'user_id', 'created_at'],
  indexes: [
    'clinical_document_id',
    'uploaded_document_id',
    'user_id',
  ],
} as const;
```

#### TypeScript Interface

```typescript
// apps/web/src/models/clinical-document-link/ClinicalDocumentLink.type.ts

export interface ClinicalDocumentLink {
  id: string;  // Composite: clinical_document_id|uploaded_document_id
  clinical_document_id: string;
  uploaded_document_id: string;
  user_id: string;
  created_at: string;
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
         │ user_id (FK)                                  │ user_id (FK)
         │                                               │
┌────────┴────────────────┐                              │
│ user_uploaded_documents │                              │
│─────────────────────────│                              │
│ id (PK, UUID)           │◄──────────┐                  │
│ user_id (FK)            │           │                  │
│ file_name               │           │                  │
│ content_type            │           │ uploaded_        │
│ data (base64)           │           │ document_id      │
│ document_date           │           │                  │
│ display_name            │           │                  │
└─────────────────────────┘           │                  │
                                      │                  │
                    ┌─────────────────┴──────────────────┤
                    │  clinical_document_links           │
                    │────────────────────────────────────│
                    │ id (PK, composite)                 │
                    │ clinical_document_id (FK) ─────────┼──┐
                    │ uploaded_document_id (FK)          │  │
                    │ user_id (FK) ──────────────────────┘  │
                    │ created_at                            │
                    └───────────────────────────────────────┤
                                                            │
                               ┌────────────────────────────┘
                               │ clinical_document_id (FK)
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
| `clinical_document_links` | `clinical_document_id` | `clinical_documents.id` | Many-to-One |
| `clinical_document_links` | `uploaded_document_id` | `user_uploaded_documents.id` | Many-to-One |
| `clinical_document_links` | `user_id` | `user_documents.id` | Many-to-One |

### Many-to-Many via Junction

- One **clinical document** can link to **many uploaded documents** (via multiple rows in `clinical_document_links`)
- One **uploaded document** can be linked from **many clinical documents** (via multiple rows in `clinical_document_links`)

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
    ▼
Document saved to user_uploaded_documents
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
Rows created in clinical_document_links
    │
    ▼
Clinical card now shows linked documents
```

### Workflow 3: View Linked Documents

```
User expands a clinical card
    │
    ▼
Card shows "Linked Documents" section
    │
    ├── Lists all linked uploaded documents
    └── Each shows: display name, date, thumbnail/icon
    │
    ▼
User can click to view, or unlink
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
│ 📎 Linked Documents:                    │
│   • Lab Report Addendum (Jan 15)  [×]   │
│   • Doctor Notes Scan (Jan 14)    [×]   │
│                                         │
│ [+ Link Document]                       │
└─────────────────────────────────────────┘
```

---

## Storage Considerations

### File Size Limits

| Constraint | Value |
|------------|-------|
| Per-file limit | 50 MB |
| Warning threshold | Show warning when storage > 80% |

### Why Base64 in RxDB?

1. **Consistency**: Matches existing pattern for `documentreference_attachment`
2. **Encryption**: Works seamlessly with SylvieJS encryption
3. **Backup/Export**: JSON export includes all data
4. **Simplicity**: No separate file system handling

### Storage Overhead

Base64 encoding increases file size by ~33%. A 10MB PDF becomes ~13.3MB in storage.

---

## Implementation Steps

### Phase 1: Data Layer

#### Step 1.1: Create UserUploadedDocument Model

Create files in `apps/web/src/models/user-uploaded-document/`:
- `UserUploadedDocument.schema.ts`
- `UserUploadedDocument.type.ts`
- `UserUploadedDocument.collection.ts`
- `UserUploadedDocument.migration.ts`

#### Step 1.2: Create ClinicalDocumentLink Model

Create files in `apps/web/src/models/clinical-document-link/`:
- `ClinicalDocumentLink.schema.ts`
- `ClinicalDocumentLink.type.ts`
- `ClinicalDocumentLink.collection.ts`
- `ClinicalDocumentLink.migration.ts`

#### Step 1.3: Register Collections

Update `apps/web/src/app/providers/RxDbProvider.tsx`:

```typescript
import { UserUploadedDocumentSchema } from '../../models/user-uploaded-document/UserUploadedDocument.collection';
import { ClinicalDocumentLinkSchema } from '../../models/clinical-document-link/ClinicalDocumentLink.collection';

export const databaseCollections = {
  // ... existing collections
  user_uploaded_documents: {
    schema: UserUploadedDocumentSchema,
    migrationStrategies: {},
  },
  clinical_document_links: {
    schema: ClinicalDocumentLinkSchema,
    migrationStrategies: {},
  },
};
```

Update `apps/web/src/app/providers/DatabaseCollections.ts`:

```typescript
import { UserUploadedDocumentCollection } from '../../models/user-uploaded-document/UserUploadedDocument.collection';
import { ClinicalDocumentLinkCollection } from '../../models/clinical-document-link/ClinicalDocumentLink.collection';

export type DatabaseCollections = {
  // ... existing collections
  user_uploaded_documents: UserUploadedDocumentCollection;
  clinical_document_links: ClinicalDocumentLinkCollection;
};
```

### Phase 2: Upload Feature

#### Step 2.1: Create Upload Modal

Create `apps/web/src/features/upload/components/UploadDocumentModal.tsx`:
- File input (accept: `.pdf`)
- Display name input (required)
- Document date picker (required)
- File size validation (< 50MB)
- Upload button

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
  // 1. Validate file size (< 50MB)
  // 2. Read file as base64 using FileReader
  // 3. Generate UUID for document
  // 4. Create document object
  // 5. Insert into user_uploaded_documents collection
  // 6. Return created document
}
```

### Phase 3: Timeline Integration

#### Step 3.1: Query Hook for Uploaded Documents

Create `apps/web/src/features/timeline/hooks/useUserUploadedDocuments.ts`:
- Query `user_uploaded_documents` for current user
- Return documents sorted by `document_date`

#### Step 3.2: Merge with Timeline

Update timeline query logic to:
- Fetch both `clinical_documents` and `user_uploaded_documents`
- Merge and sort by date
- Distinguish uploaded docs with a flag or wrapper type

#### Step 3.3: Create Upload Card Component

Create `apps/web/src/features/timeline/components/cards/UserUploadedDocumentCard.tsx`:
- PDF icon
- Display name
- Effective date
- Visual indicator that it's user-uploaded (e.g., "Uploaded" badge)
- Click to expand/view

#### Step 3.4: Create Expandable Viewer

Create `apps/web/src/features/timeline/components/expandables/ShowUserUploadedDocumentExpandable.tsx`:
- PDF viewer (iframe-based)
- Display metadata (name, date, file size)
- Edit button (rename, change date)
- Delete button with confirmation
- Download button

#### Step 3.5: Update TimelineItem

Update `apps/web/src/features/timeline/components/layout/TimelineItem.tsx` to render `UserUploadedDocumentCard` for uploaded documents.

### Phase 4: Linking Feature

#### Step 4.1: Link Document Modal

Create `apps/web/src/features/timeline/components/LinkDocumentModal.tsx`:
- Search input to filter uploaded documents by display name
- List of matching uploaded documents
- Checkbox selection for multiple links
- "Link" button to create links

#### Step 4.2: Link Service

Create `apps/web/src/features/timeline/services/linkDocument.ts`:

```typescript
export async function linkDocument(
  db: RxDatabase<DatabaseCollections>,
  clinicalDocumentId: string,
  uploadedDocumentId: string,
  userId: string
): Promise<ClinicalDocumentLink> {
  // Create row in clinical_document_links
}

export async function unlinkDocument(
  db: RxDatabase<DatabaseCollections>,
  clinicalDocumentId: string,
  uploadedDocumentId: string
): Promise<void> {
  // Delete row from clinical_document_links
}

export async function getLinkedDocuments(
  db: RxDatabase<DatabaseCollections>,
  clinicalDocumentId: string
): Promise<UserUploadedDocument[]> {
  // Query clinical_document_links for this clinical doc
  // Fetch corresponding uploaded documents
}
```

#### Step 4.3: Add Link UI to Clinical Cards

Update existing clinical card expandables to:
- Show "Linked Documents" section
- Display linked uploaded docs with unlink button
- Add "Link Document" button that opens LinkDocumentModal

### Phase 5: UI Entry Points

#### Step 5.1: Upload Button in Timeline

Add upload button to Timeline header/toolbar:
- Icon: Upload or Plus icon
- Opens UploadDocumentModal

---

## File Structure Summary

```
apps/web/src/
├── models/
│   ├── user-uploaded-document/
│   │   ├── UserUploadedDocument.schema.ts
│   │   ├── UserUploadedDocument.type.ts
│   │   ├── UserUploadedDocument.collection.ts
│   │   └── UserUploadedDocument.migration.ts
│   │
│   └── clinical-document-link/
│       ├── ClinicalDocumentLink.schema.ts
│       ├── ClinicalDocumentLink.type.ts
│       ├── ClinicalDocumentLink.collection.ts
│       └── ClinicalDocumentLink.migration.ts
│
├── features/
│   ├── upload/
│   │   ├── components/
│   │   │   └── UploadDocumentModal.tsx
│   │   ├── hooks/
│   │   │   └── useUploadDocument.ts
│   │   └── services/
│   │       └── uploadDocument.ts
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
│       ├── hooks/
│       │   └── useUserUploadedDocuments.ts
│       └── services/
│           └── linkDocument.ts
│
└── app/
    └── providers/
        ├── RxDbProvider.tsx      (modified)
        └── DatabaseCollections.ts (modified)
```

---

## No Backend Changes Required

The feature is entirely client-side:
- Files stored in browser IndexedDB
- No server-side storage needed
- Data automatically included in backup/export

---

## Testing Strategy

### Unit Tests
- Schema validation
- File size validation
- Base64 encoding/decoding
- Link/unlink operations
- Composite key generation for links

### Integration Tests
- Upload flow end-to-end
- Timeline display with mixed document types
- Link creation and display
- Backup/restore with uploaded documents and links

### E2E Tests (Playwright)
- Upload a PDF with display name and date
- Verify PDF appears on timeline at correct date
- Link uploaded document from clinical card
- View linked documents on clinical card
- Unlink document
- Delete uploaded document

---

## Success Metrics

- Users can upload PDF files up to 50MB
- Upload requires display name and effective date
- Uploaded documents appear on timeline at effective date
- Users can link uploaded docs to clinical cards via search
- Linked documents display on clinical card when expanded
- Documents persist across browser sessions
- Documents included in backup exports
- Works with encrypted database mode
