import { ToolCall } from './ollamaChat';
import { referenceTools } from './referenceTools';
import { dispatchTool } from './tools';

function run(call: ToolCall): Promise<string> {
  return dispatchTool(referenceTools(), call);
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const OUTLINE = {
  reference: {
    id: 'va-dod-hypertension',
    title: 'VA-DoD Hypertension Guideline',
    edition: '2026',
  },
  section: null,
  sections: [
    {
      sectionId: 'ix-recommendations',
      title: 'IX. Recommendations',
      chars: 0,
      location: { kind: 'pages', start: 26, end: 26 },
      subsections: [
        {
          sectionId: 'page-34',
          title: 'Page 34',
          chars: 3744,
          location: { kind: 'pages', start: 34, end: 35 },
          subsectionCount: 2,
        },
      ],
    },
  ],
};

const HYPERTENSION = {
  id: 'va-dod-hypertension',
  title: 'VA-DoD Hypertension Guideline',
  edition: '2026',
  summary: 'High blood pressure in adults',
};

describe('search_references', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows ranked references with ids and the total', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        references: [HYPERTENSION],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    );

    expect(
      await run({
        name: 'search_references',
        args: { query: ['high blood pressure', 'hypertension'] },
      }),
    ).toEqual(
      'va-dod-hypertension | VA-DoD Hypertension Guideline | 2026 | High blood pressure in adults\n' +
        'Showing 1-1 of 1 references. Call get_outline with a reference id to see its sections.',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references/search?q=high%20blood%20pressure&q=hypertension&page=1',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('names the next page when more references match', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        references: [HYPERTENSION],
        total: 41,
        page: 2,
        pageSize: 20,
      }),
    );

    expect(
      await run({
        name: 'search_references',
        args: { query: 'hypertension', page: 2 },
      }),
    ).toEqual(
      'va-dod-hypertension | VA-DoD Hypertension Guideline | 2026 | High blood pressure in adults\n' +
        'Showing 21-21 of 41 references. Call search_references with page 3 for more, or get_outline with a reference id to see its sections.',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references/search?q=hypertension&page=2',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('says when a page is past the last one', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ references: [], total: 41, page: 5, pageSize: 20 }),
      );

    expect(
      await run({
        name: 'search_references',
        args: { query: 'hypertension', page: 5 },
      }),
    ).toEqual('Page 5 is past the last page (3) of 41 references.');
  });

  it('suggests other words and says what a second miss means when nothing matches', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ references: [], total: 0, page: 1, pageSize: 20 }),
      );

    expect(
      await run({
        name: 'search_references',
        args: { query: ['migraine', 'headache'] },
      }),
    ).toEqual(
      'No references match "migraine", "headache". Try synonyms, lay terms, or single key words; if those find nothing either, the library does not cover this topic.',
    );
  });

  it('reads an unusable page as the first page', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ references: [], total: 0, page: 1, pageSize: 20 }),
      );

    await run({ name: 'search_references', args: { query: 'x', page: 'two' } });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references/search?q=x&page=1',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('degrades when the server is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

    expect(
      await run({ name: 'search_references', args: { query: 'x' } }),
    ).toEqual('Reference material is unavailable right now.');
  });

  it('rethrows an abort instead of degrading', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(
      run({ name: 'search_references', args: { query: 'x' } }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('list_references', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('browses a page of the catalog with the total', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        references: [HYPERTENSION],
        total: 51,
        page: 1,
        pageSize: 50,
      }),
    );

    expect(await run({ name: 'list_references', args: {} })).toEqual(
      'va-dod-hypertension | VA-DoD Hypertension Guideline | 2026 | High blood pressure in adults\n' +
        'Showing 1-1 of 51 references. Call list_references with page 2 for more, or get_outline with a reference id to see its sections.',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references?page=1',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('says nothing is on file for an empty catalog', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ references: [], total: 0, page: 1, pageSize: 50 }),
      );

    expect(await run({ name: 'list_references', args: {} })).toEqual(
      'No reference material on file.',
    );
  });
});

describe('get_outline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows two levels with ids, sizes, pages, and subsection counts', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(OUTLINE));

    expect(
      await run({
        name: 'get_outline',
        args: { reference: 'va-dod-hypertension' },
      }),
    ).toEqual(
      'VA-DoD Hypertension Guideline (2026)\n' +
        'ix-recommendations | IX. Recommendations | 0 chars | p. 26\n' +
        '  page-34 | Page 34 | 3744 chars | pp. 34-35 | 2 subsections\n' +
        'Call read_section with a section id to read it, or get_outline with a section id to expand it.',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references/va-dod-hypertension/outline',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('leads an expanded outline with the section and points at its own text', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        reference: {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
        },
        section: {
          sectionId: 'ix-recommendations',
          title: 'IX. Recommendations',
          chars: 6365,
          location: { kind: 'pages', start: 26, end: 28 },
        },
        sections: [
          {
            sectionId: 'a-diagnosis-and-monitoring',
            title: 'A. Diagnosis and Monitoring',
            chars: 0,
            location: { kind: 'pages', start: 29, end: 29 },
            subsections: [
              {
                sectionId: 'page-29',
                title: 'Page 29',
                chars: 3054,
                location: { kind: 'pages', start: 29, end: 29 },
                subsectionCount: 0,
              },
            ],
          },
        ],
      }),
    );

    expect(
      await run({
        name: 'get_outline',
        args: {
          reference: 'va-dod-hypertension',
          section: 'ix-recommendations',
        },
      }),
    ).toEqual(
      'VA-DoD Hypertension Guideline (2026)\n' +
        'ix-recommendations | IX. Recommendations | 6365 chars | pp. 26-28 | has its own text: read_section to read it\n' +
        '  a-diagnosis-and-monitoring | A. Diagnosis and Monitoring | 0 chars | p. 29\n' +
        '    page-29 | Page 29 | 3054 chars | p. 29\n' +
        'Call read_section with a section id to read it, or get_outline with a section id to expand it.',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references/va-dod-hypertension/outline/ix-recommendations',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('omits the own-text pointer and webpage locations when a section has no text of its own', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        reference: {
          id: 'uspstf-a-and-b',
          title: 'USPSTF A and B Recommendations',
          edition: 'Updated continuously',
        },
        section: {
          sectionId: 'main',
          title: 'Main',
          chars: 0,
          location: { kind: 'webpage' },
        },
        sections: [
          {
            sectionId: 'a-b-recommendations',
            title: 'A & B Recommendations',
            chars: 24550,
            location: { kind: 'webpage' },
            subsections: [],
          },
        ],
      }),
    );

    expect(
      await run({
        name: 'get_outline',
        args: { reference: 'uspstf-a-and-b', section: 'main' },
      }),
    ).toEqual(
      'USPSTF A and B Recommendations (Updated continuously)\n' +
        'main | Main | 0 chars\n' +
        '  a-b-recommendations | A & B Recommendations | 24550 chars\n' +
        'Call read_section with a section id to read it, or get_outline with a section id to expand it.',
    );
  });

  it('says a section has no subsections and points at reading it', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ ...OUTLINE, sections: [] }));

    expect(
      await run({
        name: 'get_outline',
        args: { reference: 'va-dod-hypertension', section: 'page-34' },
      }),
    ).toEqual(
      'No subsections under "page-34". Call read_section with section "page-34" to read it.',
    );
  });

  it('points an unknown reference at search_references', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'no-reference' }, 404));

    expect(
      await run({ name: 'get_outline', args: { reference: 'nope' } }),
    ).toEqual('No reference "nope". Call search_references to find one.');
  });

  it('points an unknown section at the reference outline', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'no-section' }, 404));

    expect(
      await run({
        name: 'get_outline',
        args: { reference: 'va-dod-hypertension', section: 'nope' },
      }),
    ).toEqual(
      'No section "nope" in va-dod-hypertension. Call get_outline with reference "va-dod-hypertension" to see its sections.',
    );
  });
});

describe('read_section', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads a section with its citation and subsection ids', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        reference: {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          url: 'https://example.com/htn.pdf',
        },
        section: {
          sectionId: 'page-34',
          title: 'Page 34',
          location: { kind: 'pages', start: 34, end: 34 },
          contentMd: 'We recommend a systolic goal of <130 mmHg.',
          subsections: [
            { sectionId: 'target-groups', title: 'Target Groups', chars: 13 },
          ],
        },
      }),
    );

    expect(
      await run({
        name: 'read_section',
        args: { reference: 'va-dod-hypertension', section: 'page-34' },
      }),
    ).toEqual(
      'VA-DoD Hypertension Guideline (2026) > Page 34, p. 34\n' +
        'https://example.com/htn.pdf\n\n' +
        'We recommend a systolic goal of <130 mmHg.\n\n' +
        'Subsections: target-groups (Target Groups, 13 chars)',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references/va-dod-hypertension/sections/page-34',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('cites the page a spoke section came from instead of the reference page', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        reference: {
          id: 'label-estradiol',
          title: 'FDA drug label: Estradiol',
          edition: '2026',
          url: 'https://dailymed.example/search?query=estradiol',
        },
        section: {
          sectionId: 'transdermal',
          title: 'Transdermal: Minivelle',
          location: { kind: 'webpage', url: 'https://dailymed.example/patch' },
          contentMd: 'Label NDA203752 by Noven, effective 2026-07-31.',
          subsections: [
            { sectionId: 'transdermal-2-dosage', title: '2 DOSAGE', chars: 19 },
          ],
        },
      }),
    );

    expect(
      await run({
        name: 'read_section',
        args: { reference: 'label-estradiol', section: 'transdermal' },
      }),
    ).toEqual(
      'FDA drug label: Estradiol (2026) > Transdermal: Minivelle\n' +
        'https://dailymed.example/patch\n\n' +
        'Label NDA203752 by Noven, effective 2026-07-31.\n\n' +
        'Subsections: transdermal-2-dosage (2 DOSAGE, 19 chars)',
    );
  });

  it('says when a section has no text of its own', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        reference: {
          id: 'uspstf-a-and-b',
          title: 'USPSTF A and B Recommendations',
          edition: 'Updated continuously',
          url: 'https://example.com/ab',
        },
        section: {
          sectionId: 'screening',
          title: 'Screening',
          location: { kind: 'webpage' },
          contentMd: '',
          subsections: [
            { sectionId: 'hypertension', title: 'Hypertension', chars: 40 },
          ],
        },
      }),
    );

    expect(
      await run({
        name: 'read_section',
        args: { reference: 'uspstf-a-and-b', section: 'screening' },
      }),
    ).toEqual(
      'USPSTF A and B Recommendations (Updated continuously) > Screening\n' +
        'https://example.com/ab\n\n' +
        '(No text of its own; read a subsection.)\n\n' +
        'Subsections: hypertension (Hypertension, 40 chars)',
    );
  });
});

describe('find_in_reference', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists matching sections with an excerpt of each, using repeated q terms', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        matches: [
          {
            sectionId: 'page-34',
            title: 'Page 34',
            count: 3,
            excerpt: '…check standing blood pressure in older adults…',
          },
          {
            sectionId: 'page-47',
            title: 'Page 47',
            count: 1,
            excerpt: 'Orthostatic hypotension was more common…',
          },
        ],
      }),
    );

    expect(
      await run({
        name: 'find_in_reference',
        args: {
          reference: 'va-dod-hypertension',
          query: ['orthostatic', 'standing blood pressure'],
        },
      }),
    ).toEqual(
      'page-34 | Page 34 | 3 matches | …check standing blood pressure in older adults…\n' +
        'page-47 | Page 47 | 1 match | Orthostatic hypotension was more common…\n' +
        'Call read_section with a section id to read it.',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/agent/references/va-dod-hypertension/find?q=orthostatic&q=standing%20blood%20pressure',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('names the terms and the outline when nothing matches', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ matches: [] }));

    expect(
      await run({
        name: 'find_in_reference',
        args: { reference: 'va-dod-hypertension', query: 'orthostatic' },
      }),
    ).toEqual(
      'No sections of va-dod-hypertension match "orthostatic". Try other terms or call get_outline with reference "va-dod-hypertension".',
    );
  });
});

describe('argument checks', () => {
  it.each([
    ['search_references', {}, 'Pass query: an array of terms to look for.'],
    ['get_outline', {}, 'Pass reference: an id from search_references.'],
    [
      'read_section',
      { reference: 'va-dod-hypertension' },
      'Pass section: an id from get_outline.',
    ],
    [
      'find_in_reference',
      { reference: 'va-dod-hypertension' },
      'Pass query: an array of terms to look for.',
    ],
  ])('%s without its argument asks for it', async (name, args, expected) => {
    global.fetch = jest.fn();

    expect(await run({ name, args })).toEqual(expected);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
