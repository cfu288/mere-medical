import { BundleEntry, FhirResource } from 'fhir/r2';

import { ClinicalDocument } from '../../../models/clinical-document/ClinicalDocument.type';
import { docsByType } from '../clinicalDocs';
import { createHarness, Harness, RunEvent } from '../harness/events';
import * as extractNoteTextModule from './extractNoteText';
import { toNoteRecords } from './noteStore';

function recordingHarness(): { harness: Harness; events: RunEvent[] } {
  const events: RunEvent[] = [];
  return {
    events,
    harness: createHarness('run-1', (event) => events.push(event)),
  };
}

function docRef(
  id: string,
  date: string,
  displayName: string,
): ClinicalDocument<BundleEntry<FhirResource>> {
  return {
    id,
    connection_record_id: 'conn-a',
    user_id: 'user-1',
    data_record: {
      raw: { resource: { resourceType: 'DocumentReference' } } as never,
      format: 'FHIR.DSTU2',
      content_type: 'application/json',
      resource_type: 'documentreference',
      version_history: [],
    },
    metadata: {
      id: `DocumentReference/${id}`,
      date,
      display_name: displayName,
    },
  };
}

const attachment: ClinicalDocument<BundleEntry<FhirResource>> = {
  id: 'att-b',
  connection_record_id: 'conn-a',
  user_id: 'user-1',
  data_record: {
    raw: 'Seen today for follow-up of hypertension.' as never,
    format: 'FHIR.DSTU2',
    content_type: 'text/plain',
    resource_type: 'documentreference_attachment',
    version_history: [],
  },
  metadata: { id: 'DocumentReference/note-b/attachment' },
};

jest.mock('./extractPdfText', () => ({
  extractPdfText: jest.fn(
    async () => 'Extracted pdf text that is long enough to count as a note.',
  ),
}));

function docRefWithContent(
  id: string,
  urls: string[],
): ClinicalDocument<BundleEntry<FhirResource>> {
  return {
    ...docRef(id, '2024-03-01T00:00:00Z', 'Note with content'),
    data_record: {
      raw: {
        resource: {
          resourceType: 'DocumentReference',
          content: urls.map((url) => ({ attachment: { url } })),
        },
      } as never,
      format: 'FHIR.DSTU2',
      content_type: 'application/json',
      resource_type: 'documentreference',
      version_history: [],
    },
  };
}

function storedAttachment(
  metadataId: string,
  raw: string | Blob,
  contentType: string,
): ClinicalDocument<BundleEntry<FhirResource>> {
  return {
    id: `att-${metadataId}`,
    connection_record_id: 'conn-a',
    user_id: 'user-1',
    data_record: {
      raw: raw as never,
      format: 'FHIR.DSTU2',
      content_type: contentType,
      resource_type: 'documentreference_attachment',
      version_history: [],
    },
    metadata: { id: metadataId },
  };
}

describe('toNoteRecords', () => {
  it('reads a text attachment stored as a blob', async () => {
    const { harness } = recordingHarness();
    const notes = toNoteRecords(
      docsByType([
        docRef('note-b', '2024-03-01T00:00:00Z', 'Blob Note'),
        storedAttachment(
          'DocumentReference/note-b/attachment',
          new Blob(['Seen today for follow-up of hypertension.'], {
            type: 'text/plain',
          }),
          'text/plain',
        ),
      ]),
      harness.emit,
    );
    expect(await notes[0].read()).toEqual({
      kind: 'text',
      format: 'plain',
      text: 'Seen today for follow-up of hypertension.',
    });
  });

  it('hands a pdf attachment stored as a blob to the extractor as base64', async () => {
    const { extractPdfText } = jest.requireMock('./extractPdfText');
    const { harness } = recordingHarness();
    const notes = toNoteRecords(
      docsByType([
        docRef('note-b', '2024-03-01T00:00:00Z', 'Pdf Note'),
        storedAttachment(
          'DocumentReference/note-b/attachment',
          new Blob(['PDF!'], { type: 'application/pdf' }),
          'application/pdf',
        ),
      ]),
      harness.emit,
    );
    expect(await notes[0].read()).toEqual({
      kind: 'text',
      format: 'pdf',
      text: 'Extracted pdf text that is long enough to count as a note.',
    });
    expect(extractPdfText).toHaveBeenCalledWith('UERGIQ==');
  });

  it('reads the first content entry that has a stored attachment', async () => {
    const { harness } = recordingHarness();
    const notes = toNoteRecords(
      docsByType([
        docRefWithContent('note-b', ['Binary/missing', 'Binary/second']),
        storedAttachment(
          'Binary/second',
          'Seen today for follow-up of hypertension.',
          'text/plain',
        ),
      ]),
      harness.emit,
    );
    expect(await notes[0].read()).toEqual({
      kind: 'text',
      format: 'plain',
      text: 'Seen today for follow-up of hypertension.',
    });
  });

  it('lists every note, sorted by date then id, without extracting', () => {
    const { harness, events } = recordingHarness();
    const notes = toNoteRecords(
      docsByType([
        docRef('note-c', '2024-02-01T00:00:00Z', 'Older Note'),
        docRef('note-b', '2025-08-14T00:00:00Z', 'Same Day B'),
        docRef('note-a', '2025-08-14T00:00:00Z', 'Same Day A'),
        attachment,
      ]),
      harness.emit,
    );
    expect(
      notes.map((n) => ({
        alias: n.alias,
        displayName: n.displayName,
        contentType: n.contentType,
      })),
    ).toEqual([
      {
        alias: 'n1',
        displayName: 'Same Day A',
        contentType: 'no attachment',
      },
      {
        alias: 'n2',
        displayName: 'Same Day B',
        contentType: 'text/plain',
      },
      {
        alias: 'n3',
        displayName: 'Older Note',
        contentType: 'no attachment',
      },
    ]);
    expect(events).toEqual([]);
  });

  it('extracts on first read, emits NoteExtracted once, and caches', async () => {
    const { harness, events } = recordingHarness();
    const notes = toNoteRecords(
      docsByType([
        docRef('note-b', '2025-08-14T00:00:00Z', 'Same Day B'),
        attachment,
      ]),
      harness.emit,
    );
    expect(await notes[0].read()).toEqual({
      kind: 'text',
      format: 'plain',
      text: 'Seen today for follow-up of hypertension.',
    });
    expect(await notes[0].read()).toEqual({
      kind: 'text',
      format: 'plain',
      text: 'Seen today for follow-up of hypertension.',
    });
    expect(events.map((e) => e.t)).toEqual(['NoteExtracted']);
    expect(events[0]).toEqual({
      t: 'NoteExtracted',
      runId: 'run-1',
      docId: 'note-b',
      contentType: 'text/plain',
      rawChars: 41,
      durationMs: expect.any(Number),
      outcome: { kind: 'text', format: 'plain', chars: 41 },
    });
  });

  it('reads a note whose extraction throws as unsupported', async () => {
    jest
      .spyOn(extractNoteTextModule, 'extractNoteText')
      .mockRejectedValueOnce(new Error('pdf worker crashed'));
    const notes = toNoteRecords(
      docsByType([
        docRef('note-b', '2025-08-14T00:00:00Z', 'Same Day B'),
        attachment,
      ]),
      recordingHarness().harness.emit,
    );
    expect(await notes[0].read()).toEqual({
      kind: 'unsupported',
      reason: 'extraction-failed',
    });
  });

  it('reads a note without an attachment as unsupported', async () => {
    const notes = toNoteRecords(
      docsByType([docRef('note-a', '2025-08-14T00:00:00Z', 'Same Day A')]),
      recordingHarness().harness.emit,
    );
    expect(await notes[0].read()).toEqual({
      kind: 'unsupported',
      reason: 'missing-attachment',
    });
  });
});
