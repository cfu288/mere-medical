import { LabIndexEntry } from '../sections/labs';
import { labTools } from './labTools';
import { ToolCall } from './ollamaChat';
import { dispatchTool } from './tools';

const index: LabIndexEntry[] = [
  {
    names: ['Hgb', 'Hemoglobin'],
    code: '718-7',
    panelNames: ['CBC w/Automated Diff'],
    results: [
      {
        display: '16.1',
        unit: 'g/dL',
        abnormal: true,
        date: { kind: 'known', iso: '2025-11-10T20:39:00.000Z' },
      },
      {
        display: '16',
        unit: 'g/dL',
        abnormal: false,
        date: { kind: 'known', iso: '2023-03-14T16:48:00Z' },
      },
    ],
  },
  {
    names: ['LC- QFT INCUBATE'],
    panelNames: ['Quantiferon Tb Gold+,1T'],
    results: [
      {
        display: 'Negative',
        abnormal: false,
        date: { kind: 'known', iso: '2023-03-14T16:48:00Z' },
      },
    ],
  },
  {
    names: ['Hemoglobin A1c'],
    code: '4548-4',
    panelNames: [],
    results: [
      {
        display: '5.1',
        unit: '%',
        abnormal: false,
        date: { kind: 'known', iso: '2025-11-10T20:39:00.000Z' },
      },
    ],
  },
];

function run(call: ToolCall): Promise<string> {
  return dispatchTool(labTools(index), call);
}

describe('labTools', () => {
  it('searches with a single string', async () => {
    expect(await run({ name: 'search_labs', args: { query: 'a1c' } })).toEqual(
      'Hemoglobin A1c [4548-4] | 5.1 % (2025-11-10)',
    );
  });

  it('searches with an array of synonyms where only one term hits', async () => {
    expect(
      await run({
        name: 'search_labs',
        args: { query: ['ppd', 'tst', 'quantiferon'] },
      }),
    ).toEqual(
      `LC- QFT INCUBATE | Negative (2023-03-14) | panel: Quantiferon Tb Gold+,1T
No matches for "ppd", "tst".`,
    );
  });

  it('matches panel names and shows draw span with name variants', async () => {
    expect(await run({ name: 'search_labs', args: { query: 'hgb' } })).toEqual(
      'Hgb [718-7] | 2 results 2023-03-14..2025-11-10, latest 16.1 g/dL* (2025-11-10) | also: Hemoglobin | panel: CBC w/Automated Diff',
    );
  });

  it('points a miss at the analyte listing', async () => {
    expect(
      await run({ name: 'search_labs', args: { query: ['igra', 't-spot'] } }),
    ).toEqual(
      'No matches for "igra", "t-spot". Use list_lab_analytes to see every analyte name on record.',
    );
  });

  it('lists no analytes on an empty record', async () => {
    expect(
      await dispatchTool(labTools([]), { name: 'list_lab_analytes', args: {} }),
    ).toEqual('No lab results on record.');
  });

  it('lists every analyte sorted by name', async () => {
    expect(await run({ name: 'list_lab_analytes', args: {} }))
      .toEqual(`Hemoglobin A1c [4548-4]
Hgb [718-7] (also: Hemoglobin)
LC- QFT INCUBATE`);
  });

  it('returns a full history by exact name', async () => {
    expect(
      await run({ name: 'get_lab_history', args: { analyte: 'hemoglobin' } }),
    ).toEqual('Hgb [718-7]: 16.1 g/dL* (2025-11-10), 16 g/dL (2023-03-14)');
  });

  it('discloses an unknown bracketed code while matching by name', async () => {
    expect(
      await run({
        name: 'get_lab_history',
        args: { analyte: 'LC- QFT INCUBATE [something-wrong]' },
      }),
    ).toEqual(
      'No analyte with code "something-wrong"; matched "LC- QFT INCUBATE" by name.\nLC- QFT INCUBATE: Negative (2023-03-14)',
    );
  });

  it('returns a full history by loinc code', async () => {
    expect(
      await run({ name: 'get_lab_history', args: { analyte: '4548-4' } }),
    ).toEqual('Hemoglobin A1c [4548-4]: 5.1 % (2025-11-10)');
  });

  it('reports ambiguous history refs with the candidates', async () => {
    expect(
      await run({ name: 'get_lab_history', args: { analyte: 'hemog' } }),
    ).toEqual(
      'Matches 2 analytes: Hgb [718-7]; Hemoglobin A1c [4548-4]. Be more specific.',
    );
  });

  it('reports an unknown history ref', async () => {
    expect(
      await run({ name: 'get_lab_history', args: { analyte: 'troponin' } }),
    ).toEqual(
      'No analyte matching "troponin". Use list_lab_analytes to see every analyte name on record.',
    );
  });
});
