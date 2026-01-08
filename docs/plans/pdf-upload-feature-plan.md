# PDF Upload Feature Implementation Plan

## Overview

This plan addresses [Issue #221](https://github.com/cfu288/mere-medical/issues/221) - adding manual data input capability, specifically the ability to upload PDF documents and associate them with medical records.

## Problem Statement

Users who have medical records from providers not covered by supported integrations (Epic, Cerner, Veradigm, etc.) need a way to manually upload documents like PDFs of lab results, imaging reports, or historical medical records.

## Architecture Considerations

### Current Architecture

- **Offline-First**: All data stored client-side in IndexedDB via RxDB
- **No Backend Database**: The NestJS backend only handles OAuth flows and proxying
- **Encryption**: Data can be optionally encrypted using a user-provided password (SylvieJS)
- **Existing Pattern**: PDFs from FHIR servers are already stored as base64 strings in `clinical_documents` collection with `resource_type: 'documentreference_attachment'`

### Design Decision: Reuse vs New Collection

**Recommended Approach**: Create a **new `user_uploaded_documents` collection** rather than reusing `clinical_documents`.

**Rationale**:
1. `clinical_documents` requires a `connection_record_id` (foreign key to a FHIR connection) which user uploads don't have
2. The primary key is composite: `connection_record_id|user_id|metadata.id` - not suitable for user uploads
3. Separating user-uploaded content from synced FHIR data maintains data integrity
4. Easier to manage, filter, and potentially delete user uploads separately
5. Future features (like linking uploads to existing records) are cleaner with a separate collection

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
      ref: 'user_documents',  // Foreign key to user_documents
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
      description: 'User-specified date of the document (e.g., date of lab results)',
    },
    display_name: {
      type: 'string',
      maxLength: 255,
      description: 'User-friendly name for the document',
    },
    description: {
      type: 'string',
      description: 'Optional user-provided description',
    },
    category: {
      type: 'string',
      maxLength: 64,
      description: 'Document category (lab_result, imaging, visit_summary, immunization, other)',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'User-defined tags for organization',
    },
    linked_clinical_documents: {
      type: 'array',
      items: {
        type: 'string',
        ref: 'clinical_documents',  // Foreign key array to clinical_documents
      },
      description: 'Optional links to related clinical documents',
    },
  },
  required: ['id', 'user_id', 'file_name', 'content_type', 'data', 'upload_date'],
  indexes: [
    'user_id',
    'document_date',
    'upload_date',
    'category',
  ],
} as const;
```

#### TypeScript Interface

```typescript
// apps/web/src/models/user-uploaded-document/UserUploadedDocument.type.ts

export type UserUploadedDocumentCategory =
  | 'lab_result'
  | 'imaging'
  | 'visit_summary'
  | 'immunization'
  | 'medication'
  | 'insurance'
  | 'other';

export interface UserUploadedDocument {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  data: string;  // Base64-encoded
  upload_date: string;
  document_date?: string;
  display_name?: string;
  description?: string;
  category?: UserUploadedDocumentCategory;
  tags?: string[];
  linked_clinical_documents?: string[];
}

export type CreateUserUploadedDocument = Omit<UserUploadedDocument, 'id'>;
```

---

## Foreign Key Relationships

### Entity Relationship Diagram

```
┌─────────────────────┐
│   user_documents    │
│─────────────────────│
│ id (PK)             │◄──────────────────────────────────────┐
│ first_name          │                                       │
│ last_name           │                                       │
│ ...                 │                                       │
└─────────────────────┘                                       │
         ▲                                                    │
         │ ref: user_documents                                │
         │                                                    │
┌─────────────────────────┐     ┌─────────────────────────────┤
│ user_uploaded_documents │     │                             │
│─────────────────────────│     │                             │
│ id (PK, UUID)           │     │                             │
│ user_id (FK) ───────────┼─────┘                             │
│ file_name               │                                   │
│ content_type            │                                   │
│ data (base64)           │                                   │
│ document_date           │                                   │
│ linked_clinical_docs[]──┼────┐                              │
└─────────────────────────┘    │                              │
                               │ ref: clinical_documents      │
                               ▼                              │
                  ┌─────────────────────────┐                 │
                  │   clinical_documents    │                 │
                  │─────────────────────────│                 │
                  │ id (PK, composite)      │                 │
                  │ user_id (FK) ───────────┼─────────────────┘
                  │ connection_record_id    │
                  │ data_record             │
                  │ metadata                │
                  └─────────────────────────┘
```

### Key Relationships

| Collection | Field | References | Relationship Type |
|------------|-------|------------|-------------------|
| `user_uploaded_documents` | `user_id` | `user_documents.id` | Many-to-One |
| `user_uploaded_documents` | `linked_clinical_documents[]` | `clinical_documents.id` | Many-to-Many |

### RxDB Foreign Key Implementation

RxDB uses the `ref` property in schema definitions to establish relationships:

```typescript
// In schema - establishes the relationship
user_id: {
  type: 'string',
  ref: 'user_documents',  // References user_documents collection
},

// Usage - populate the relationship
const uploadedDoc = await db.user_uploaded_documents.findOne(docId).exec();
const user = await uploadedDoc.populate('user_id');  // Fetches related user
```

---

## Storage Considerations

### File Size Limits

| Constraint | Recommendation |
|------------|----------------|
| Per-file limit | 50 MB maximum |
| Total storage | Monitor IndexedDB quota (typically 50GB+ on desktop) |
| Warning threshold | Show warning when storage usage > 80% |

### Why Base64 in RxDB?

1. **Consistency**: Matches existing pattern for `documentreference_attachment` PDFs
2. **Encryption**: Base64 strings work seamlessly with SylvieJS encryption
3. **Backup/Export**: JSON export includes all data without binary handling
4. **Simplicity**: No need for separate OPFS or file system API handling

### Storage Size Impact

Base64 encoding increases file size by ~33%. A 10MB PDF becomes ~13.3MB in storage.

---

## Implementation Steps

### Phase 1: Data Layer

#### Step 1.1: Create Model Files

Create the following files in `apps/web/src/models/user-uploaded-document/`:

- `UserUploadedDocument.schema.ts` - Schema definition
- `UserUploadedDocument.type.ts` - TypeScript interfaces
- `UserUploadedDocument.collection.ts` - RxDB collection export
- `UserUploadedDocument.migration.ts` - Migration strategies (empty for v0)

#### Step 1.2: Register Collection

Update `apps/web/src/app/providers/RxDbProvider.tsx`:

```typescript
import { UserUploadedDocumentSchema } from '../../models/user-uploaded-document/UserUploadedDocument.collection';

export const databaseCollections = {
  // ... existing collections
  user_uploaded_documents: {
    schema: UserUploadedDocumentSchema,
    migrationStrategies: {},
  },
};
```

Update `apps/web/src/app/providers/DatabaseCollections.ts`:

```typescript
import { UserUploadedDocumentCollection } from '../../models/user-uploaded-document/UserUploadedDocument.collection';

export type DatabaseCollections = {
  // ... existing collections
  user_uploaded_documents: UserUploadedDocumentCollection;
};
```

### Phase 2: Upload Feature

#### Step 2.1: Create Upload Modal Component

Create `apps/web/src/features/upload/components/UploadDocumentModal.tsx`:

- File input (accept: `.pdf,.jpg,.jpeg,.png`)
- Display name input
- Document date picker
- Category dropdown
- Optional description textarea
- Optional tags input
- Upload progress indicator
- File size validation
- Preview for images

#### Step 2.2: Create Upload Service

Create `apps/web/src/features/upload/services/uploadDocument.ts`:

```typescript
export async function uploadDocument(
  db: RxDatabase<DatabaseCollections>,
  file: File,
  userId: string,
  metadata: {
    displayName?: string;
    documentDate?: string;
    category?: UserUploadedDocumentCategory;
    description?: string;
    tags?: string[];
  }
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

#### Step 3.1: Update Timeline Query

Modify `apps/web/src/features/timeline/hooks/` to also query `user_uploaded_documents`:

- Create hook: `useUserUploadedDocuments.ts`
- Merge results with clinical documents for unified timeline display
- Sort by `document_date` (or `upload_date` if not provided)

#### Step 3.2: Create Upload Card Component

Create `apps/web/src/features/timeline/components/cards/UserUploadedDocumentCard.tsx`:

- Thumbnail preview for images
- PDF icon for PDFs
- Display name, date, category badge
- Click to expand/view document

#### Step 3.3: Create Expandable Viewer

Create `apps/web/src/features/timeline/components/expandables/ShowUserUploadedDocumentExpandable.tsx`:

- Full PDF viewer (iframe-based, matching existing pattern)
- Full image viewer
- Download button
- Edit metadata button
- Delete button with confirmation

#### Step 3.4: Update TimelineItem

Add handling for user uploads in `apps/web/src/features/timeline/components/layout/TimelineItem.tsx`:

```typescript
{item.data_record?.resource_type === 'user_uploaded' && (
  <UserUploadedDocumentCard
    key={item.id}
    item={item as UserUploadedDocument}
  />
)}
```

### Phase 4: UI Entry Points

#### Step 4.1: Add Upload Button to Timeline

Add floating action button or header button in Timeline view:
- Location: Top-right of timeline or in the filter bar
- Icon: Upload/Plus icon
- Action: Opens UploadDocumentModal

#### Step 4.2: Add to Settings (Optional)

Consider adding a section in Settings to:
- View all uploaded documents
- Manage storage usage
- Bulk delete uploads

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
│   ├── upload/                          # New feature module
│   │   ├── components/
│   │   │   ├── UploadDocumentModal.tsx
│   │   │   ├── FileDropzone.tsx
│   │   │   └── UploadProgress.tsx
│   │   ├── hooks/
│   │   │   └── useUploadDocument.ts
│   │   └── services/
│   │       └── uploadDocument.ts
│   │
│   └── timeline/
│       ├── components/
│       │   ├── cards/
│       │   │   └── UserUploadedDocumentCard.tsx  # New
│       │   ├── expandables/
│       │   │   └── ShowUserUploadedDocumentExpandable.tsx  # New
│       │   └── layout/
│       │       └── TimelineItem.tsx              # Modified
│       └── hooks/
│           └── useUserUploadedDocuments.ts       # New
│
└── app/
    └── providers/
        ├── RxDbProvider.tsx             # Modified
        └── DatabaseCollections.ts       # Modified
```

---

## API Summary

### No Backend Changes Required

The PDF upload feature is entirely client-side:
- Files stored in browser IndexedDB
- No server-side storage needed
- Follows existing offline-first architecture
- Data automatically included in backup/export functionality

---

## Future Enhancements (Out of Scope)

1. **Link to Existing Records**: UI to associate uploaded PDFs with existing clinical documents
2. **OCR/Text Extraction**: Extract text from PDFs for search indexing
3. **Vector Embeddings**: Integrate with `vector_storage` for AI-powered search
4. **Manual FHIR Entry**: Form-based entry of structured data (immunizations, labs, etc.)
5. **Cloud Sync**: Optional backend sync for cross-device access

---

## Testing Strategy

### Unit Tests
- Schema validation
- File size validation
- Base64 encoding/decoding
- Document CRUD operations

### Integration Tests
- Upload flow end-to-end
- Timeline display with mixed document types
- Backup/restore with uploaded documents
- Encrypted database with uploads

### E2E Tests (Playwright)
- Upload a PDF and verify display
- Edit document metadata
- Delete document
- Filter timeline by uploaded documents

---

## Success Metrics

- Users can upload PDF/image files up to 50MB
- Uploaded documents appear in timeline chronologically
- Documents persist across browser sessions
- Documents are included in backup exports
- Documents work with encrypted database mode
