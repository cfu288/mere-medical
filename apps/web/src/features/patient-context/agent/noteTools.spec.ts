import { NoteRecord } from '../notes/noteRecord';
import { noteTools, searchNotes } from './noteTools';
import { dispatchTool, runTool } from './tools';

const notes: NoteRecord[] = [
  {
    alias: 'n1',
    date: { kind: 'known', iso: '2025-08-14T00:00:00Z' },
    displayName: 'Progress Note',
    contentType: 'application/xml',
    read: async () => ({
      kind: 'text',
      format: 'ccda',
      text: '== HISTORY OF PRESENT ILLNESS ==\nChris Fu is a 32 y/o M with hypertension. Here for follow-up.',
    }),
  },
  {
    alias: 'n2',
    date: { kind: 'known', iso: '2025-06-01T00:00:00Z' },
    displayName: 'Scanned Letter',
    contentType: 'application/pdf',
    read: async () => ({ kind: 'unsupported', reason: 'pdf-no-text-layer' }),
  },
];

describe('noteTools', () => {
  it('lists notes with dates and content types', async () => {
    expect(
      await dispatchTool(noteTools(notes), {
        name: 'list_recent_notes',
        args: {},
      }),
    ).toEqual(`n1 | 2025-08-14 | Progress Note | application/xml
n2 | 2025-06-01 | Scanned Letter | application/pdf`);
  });

  it('reads a note by id', async () => {
    expect(
      await dispatchTool(noteTools(notes), {
        name: 'read_note',
        args: { id: 'n1' },
      }),
    ).toEqual(
      '== HISTORY OF PRESENT ILLNESS ==\nChris Fu is a 32 y/o M with hypertension. Here for follow-up.',
    );
  });

  it('lists no notes on an empty record', async () => {
    expect(
      await dispatchTool(noteTools([]), {
        name: 'list_recent_notes',
        args: {},
      }),
    ).toEqual('No clinical notes on record.');
  });

  it('serves a long note in parts with a continue hint', async () => {
    const longNotes: NoteRecord[] = [
      {
        alias: 'n9',
        date: { kind: 'known', iso: '2025-08-14T00:00:00Z' },
        displayName: 'Long Note',
        contentType: 'application/pdf',
        read: async () => ({
          kind: 'text',
          format: 'pdf',
          text: 'aaaa'.repeat(2000) + '\n' + 'bbbb'.repeat(2000),
        }),
      },
    ];

    const first = await dispatchTool(noteTools(longNotes), {
      name: 'read_note',
      args: { id: 'n9' },
    });
    expect(first).toContain('[part 1 of 2]');
    expect(first).toContain('aaaa');
    expect(first).not.toContain('bbbb');
    expect(first).toContain('Call read_note with part 2 to continue.');

    const second = await dispatchTool(noteTools(longNotes), {
      name: 'read_note',
      args: { id: 'n9', part: 2 },
    });
    expect(second).toContain('[part 2 of 2]');
    expect(second).toContain('bbbb');
    expect(second).not.toContain('aaaa');
    expect(second).not.toContain('to continue');
  });

  it('rejects a part beyond the note', async () => {
    expect(
      await dispatchTool(noteTools(notes), {
        name: 'read_note',
        args: { id: 'n1', part: 3 },
      }),
    ).toEqual('Note "n1" has 1 part(s); ask for a part between 1 and 1.');
  });

  it('discloses when the result budget stopped the scan early', async () => {
    const twoNotes: NoteRecord[] = [
      {
        alias: 'n8',
        date: { kind: 'known', iso: '2025-08-14T00:00:00Z' },
        displayName: 'Progress Note',
        contentType: 'application/xml',
        read: async () => ({
          kind: 'text',
          format: 'ccda',
          text: 'alpha needle beta',
        }),
      },
      {
        alias: 'n9',
        date: { kind: 'known', iso: '2025-06-01T00:00:00Z' },
        displayName: 'Older Note',
        contentType: 'application/xml',
        read: async () => ({
          kind: 'text',
          format: 'ccda',
          text: 'gamma needle delta',
        }),
      },
    ];
    expect((await searchNotes(['needle'], twoNotes, 30)).text).toEqual(
      'n8 (2025-08-14): ...alpha needle beta...\n[stopped after 1 of 2 notes; narrow the terms to search the rest]',
    );
  });

  it('aborts a scan when the signal fires', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      dispatchTool(noteTools(notes, controller.signal), {
        name: 'search_notes',
        args: { query: 'needle' },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns a recoverable error string for an unknown id', async () => {
    expect(
      await dispatchTool(noteTools(notes), {
        name: 'read_note',
        args: { id: 'nope' },
      }),
    ).toEqual(
      'No note with id "nope". Use list_recent_notes to see valid ids.',
    );
  });

  it('reports unsupported notes as unreadable', async () => {
    expect(
      await dispatchTool(noteTools(notes), {
        name: 'read_note',
        args: { id: 'n2' },
      }),
    ).toEqual('Note "n2" is not readable (pdf-no-text-layer).');
  });

  it('searches with an array of synonyms where only one term hits', async () => {
    expect(
      await dispatchTool(noteTools(notes), {
        name: 'search_notes',
        args: { query: ['ppd', 'y/o'] },
      }),
    ).toEqual(
      `n1 (2025-08-14): ...== HISTORY OF PRESENT ILLNESS == Chris Fu is a 32 y/o M with hypertension. Here for follow-up....
No matches for "ppd".
[1 unreadable note(s) not searched]`,
    );
  });

  it('reports zero matches plainly', async () => {
    expect(
      await dispatchTool(noteTools(notes), {
        name: 'search_notes',
        args: { query: 'colonoscopy' },
      }),
    ).toEqual(
      'No matches for "colonoscopy". Use list_recent_notes and read_note to scan individual notes.\n[1 unreadable note(s) not searched]',
    );
  });
});

describe('noteTools retrieval', () => {
  it('reports the note read_note returned', async () => {
    expect(
      (
        await runTool(noteTools(notes), {
          name: 'read_note',
          args: { id: 'n1' },
        })
      ).retrieved,
    ).toEqual([{ kind: 'note', id: 'n1', part: 1 }]);
  });

  it('reports the part read_note returned', async () => {
    expect(
      (
        await runTool(
          noteTools([
            {
              alias: 'n9',
              date: { kind: 'known', iso: '2025-08-14T00:00:00Z' },
              displayName: 'Long Note',
              contentType: 'application/pdf',
              read: async () => ({
                kind: 'text',
                format: 'pdf',
                text: 'aaaa'.repeat(2000) + '\n' + 'bbbb'.repeat(2000),
              }),
            },
          ]),
          { name: 'read_note', args: { id: 'n9', part: 2 } },
        )
      ).retrieved,
    ).toEqual([{ kind: 'note', id: 'n9', part: 2 }]);
  });

  it('reports nothing for a note it could not read', async () => {
    expect(
      (
        await runTool(noteTools(notes), {
          name: 'read_note',
          args: { id: 'n2' },
        })
      ).retrieved,
    ).toEqual([]);
  });

  it('reports nothing for search snippets, which show only part of a note', async () => {
    expect(
      (
        await runTool(noteTools(notes), {
          name: 'search_notes',
          args: { query: ['hypertension'] },
        })
      ).retrieved,
    ).toEqual([]);
  });

  it('reports nothing for the note list, which shows only titles', async () => {
    expect(
      (await runTool(noteTools(notes), { name: 'list_recent_notes', args: {} }))
        .retrieved,
    ).toEqual([]);
  });
});
