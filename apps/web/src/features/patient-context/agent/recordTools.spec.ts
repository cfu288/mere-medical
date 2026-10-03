import { RecordIndex } from '../sections/recordIndex';
import { ToolCall } from './ollamaChat';
import { recordTools } from './recordTools';
import { dispatchTool } from './tools';

const index: RecordIndex = {
  entries: [
    {
      type: 'appointment',
      name: 'WMC Employee Annual Assessment',
      date: { kind: 'known', iso: '2026-09-14T12:00:00Z' },
      facts: ['booked'],
    },
    {
      type: 'appointment',
      name: 'APS Workforce New Patient',
      date: { kind: 'known', iso: '2025-12-18T18:00:00Z' },
      facts: ['fulfilled'],
    },
    {
      type: 'condition',
      name: 'Penicillin rash',
      date: { kind: 'known', iso: '2025-11-10T00:00:00Z' },
      facts: ['active/confirmed'],
    },
    {
      type: 'coverage',
      name: 'Managed Care - PPO',
      date: { kind: 'known', iso: '2022-10-01' },
      dateLabel: '2022-10-01..2025-07-31',
      facts: ['Aetna'],
    },
    {
      type: 'allergy',
      name: 'PENICILLINS',
      date: { kind: 'known', iso: '2022-08-30T00:00:00Z' },
      facts: [],
    },
    {
      type: 'immunization',
      name: 'Influenza vaccine',
      date: { kind: 'known', iso: '2021-10-01T00:00:00Z' },
      facts: [],
    },
  ],
  alsoOnRecord: [{ type: 'familymemberhistory', count: 2 }],
};

function run(call: ToolCall): Promise<string> {
  return dispatchTool(recordTools(index), call);
}

describe('recordTools', () => {
  it('lists a type newest first', async () => {
    expect(
      await run({ name: 'search_records', args: { types: ['appointment'] } }),
    )
      .toEqual(`[appointment] WMC Employee Annual Assessment | 2026-09-14 | booked
[appointment] APS Workforce New Patient | 2025-12-18 | fulfilled`);
  });

  it('matches a query across types', async () => {
    expect(await run({ name: 'search_records', args: { query: 'penicillin' } }))
      .toEqual(`[condition] Penicillin rash | 2025-11-10 | active/confirmed
[allergy] PENICILLINS | 2022-08-30`);
  });

  it('intersects query with a type filter', async () => {
    expect(
      await run({
        name: 'search_records',
        args: { query: 'penicillin', types: ['condition'] },
      }),
    ).toEqual('[condition] Penicillin rash | 2025-11-10 | active/confirmed');
  });

  it('searches with an array of synonyms where only one term hits', async () => {
    expect(
      await run({ name: 'search_records', args: { query: ['uhc', 'aetna'] } }),
    ).toEqual(`[coverage] Managed Care - PPO | 2022-10-01..2025-07-31 | Aetna
No matches for "uhc".`);
  });

  it('shows the overview after a miss', async () => {
    expect(await run({ name: 'search_records', args: { query: 'statin' } }))
      .toEqual(`No matches for "statin".
On record: appointment (2), allergy (1), condition (1), coverage (1), immunization (1).
Also on record but not searchable here: familymemberhistory (2).
Lab results are searchable with search_labs; note text with search_notes.`);
  });

  it('answers an unknown type with the valid list', async () => {
    expect(
      await run({ name: 'search_records', args: { types: ['provenance'] } }),
    ).toEqual(
      'Unknown type "provenance". Valid types: condition, medication, immunization, allergy, encounter, procedure, appointment, coverage, careteam, careplan, order, document, report.',
    );
  });

  it('returns the category overview when called with no arguments', async () => {
    expect(await run({ name: 'search_records', args: {} }))
      .toEqual(`On record: appointment (2), allergy (1), condition (1), coverage (1), immunization (1).
Also on record but not searchable here: familymemberhistory (2).
Lab results are searchable with search_labs; note text with search_notes.`);
  });

  it('says an empty record has nothing on it', async () => {
    expect(
      await dispatchTool(recordTools({ entries: [], alsoOnRecord: [] }), {
        name: 'search_records',
        args: {},
      }),
    ).toEqual(
      'Nothing on record.\nLab results are searchable with search_labs; note text with search_notes.',
    );
  });
});
