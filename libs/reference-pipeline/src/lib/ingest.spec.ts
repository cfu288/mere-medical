import { TWO_SIZE_PDF } from './__fixtures__/twoSizePdf';
import { ingestSources } from './ingest';
import { openReferencesDb } from './referencesDb';
import { Source } from './sources';

const USPSTF: Source = {
  id: 'uspstf-a-and-b',
  title: 'USPSTF A and B Recommendations',
  edition: 'Updated continuously',
  summary: 'Screening and prevention',
  url: 'https://example.com/ab',
  type: 'html',
};

const CDC_ADULT: Source = {
  id: 'cdc-adult-schedule',
  title: 'CDC Adult Immunization Schedule',
  edition: '2026',
  summary: 'Vaccines for adults',
  url: 'https://example.com/adult.pdf',
  type: 'pdf',
};

function bytesFor(bodies: Record<string, string>) {
  return async (url: string) => new TextEncoder().encode(bodies[url]);
}

function rows(db: ReturnType<typeof openReferencesDb>) {
  return {
    documents: db
      .prepare(
        'SELECT id, title, edition, summary, url FROM documents ORDER BY id',
      )
      .all(),
    sections: db
      .prepare('SELECT * FROM sections ORDER BY document_id, position')
      .all(),
  };
}

describe('ingestSources', () => {
  it('stores an html source as a document and its sections, reporting the outline and dropped sections', async () => {
    const db = openReferencesDb(':memory:');
    const report = await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: bytesFor({
        'https://example.com/ab':
          '<h1>Screening</h1><p>Screen adults.</p><h2>Hypertension</h2><p>Measure blood pressure.</p><h1>References</h1><p>1. Smith.</p>',
      }),
    });

    expect(rows(db)).toEqual({
      documents: [
        {
          id: 'uspstf-a-and-b',
          title: 'USPSTF A and B Recommendations',
          edition: 'Updated continuously',
          summary: 'Screening and prevention',
          url: 'https://example.com/ab',
        },
      ],
      sections: [
        {
          document_id: 'uspstf-a-and-b',
          section_id: 'screening',
          parent_id: null,
          position: 0,
          title: 'Screening',
          page_start: null,
          page_end: null,
          content_md: 'Screen adults.',
        },
        {
          document_id: 'uspstf-a-and-b',
          section_id: 'hypertension',
          parent_id: 'screening',
          position: 1,
          title: 'Hypertension',
          page_start: null,
          page_end: null,
          content_md: 'Measure blood pressure.',
        },
      ],
    });
    expect(report).toEqual({
      references: [
        {
          id: 'uspstf-a-and-b',
          outline: [
            { depth: 0, sectionId: 'screening', title: 'Screening', chars: 14 },
            {
              depth: 1,
              sectionId: 'hypertension',
              title: 'Hypertension',
              chars: 23,
            },
          ],
          dropped: ['References'],
        },
      ],
      skipped: [],
    });
  });

  it('stores a pdf source with page locations', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [CDC_ADULT],
      fetchBytes: bytesFor({ 'https://example.com/adult.pdf': TWO_SIZE_PDF }),
    });

    expect(rows(db).sections).toEqual([
      {
        document_id: 'cdc-adult-schedule',
        section_id: 'i-introduction',
        parent_id: null,
        position: 0,
        title: 'I. Introduction',
        page_start: 1,
        page_end: 1,
        content_md: 'Tdap booster every 10 years.',
      },
    ]);
  });

  it('stores a cdc media source under the cdc page it syndicates and skips a second media id for the same page', async () => {
    const db = openReferencesDb(':memory:');
    const media = (mediaId: number, id: string) => ({
      id,
      title: 'CDC: About Shingles',
      edition: '2025',
      summary: 'Shingles basics',
      type: 'cdc-media' as const,
      mediaId,
    });
    const fetchBytes = bytesFor({
      'https://tools.cdc.gov/api/v2/resources/media/1.json': JSON.stringify({
        results: [
          { sourceUrl: 'https://www.cdc.gov/shingles/about/index.html' },
        ],
      }),
      'https://tools.cdc.gov/api/v2/resources/media/1/content.html':
        '<h2>About</h2><p>Shingles is a painful rash.</p>',
      'https://tools.cdc.gov/api/v2/resources/media/2.json': JSON.stringify({
        results: [
          { sourceUrl: 'https://www.cdc.gov/shingles/about/index.html' },
        ],
      }),
      'https://tools.cdc.gov/api/v2/resources/media/2/content.html':
        '<h2>About</h2><p>Shingles is a painful rash.</p>',
    });

    const result = await ingestSources({
      db,
      sources: [
        media(1, 'cdc-about-shingles'),
        media(2, 'cdc-about-shingles-2'),
      ],
      fetchBytes,
    });

    expect(rows(db)).toEqual({
      documents: [
        {
          id: 'cdc-about-shingles',
          title: 'CDC: About Shingles',
          edition: '2025',
          summary: 'Shingles basics',
          url: 'https://www.cdc.gov/shingles/about/index.html',
        },
      ],
      sections: [
        {
          document_id: 'cdc-about-shingles',
          section_id: 'about',
          parent_id: null,
          position: 0,
          title: 'About',
          page_start: null,
          page_end: null,
          content_md: 'Shingles is a painful rash.',
        },
      ],
    });
    expect(result.skipped).toEqual([
      {
        id: 'cdc-about-shingles-2',
        url: 'https://www.cdc.gov/shingles/about/index.html',
      },
    ]);
  });

  it('replaces the whole library, removing documents no longer configured', async () => {
    const db = openReferencesDb(':memory:');
    const adultPage: Source = {
      ...CDC_ADULT,
      type: 'html',
      url: 'https://example.com/adult',
    };
    const fetchBytes = bytesFor({
      'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      'https://example.com/adult': '<h1>Adults</h1><p>Tdap every 10 years.</p>',
    });
    await ingestSources({ db, sources: [USPSTF, adultPage], fetchBytes });
    await ingestSources({ db, sources: [adultPage], fetchBytes });

    expect(
      db
        .prepare('SELECT id FROM documents')
        .all()
        .map((r) => r['id']),
    ).toEqual(['cdc-adult-schedule']);
    expect(
      db.prepare('SELECT DISTINCT document_id FROM sections').all(),
    ).toEqual([{ document_id: 'cdc-adult-schedule' }]);
  });

  it('stores a drug label with its title, edition, summary, and dailymed page derived at ingest', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [
        {
          id: 'label-metoprolol-succinate',
          type: 'drug-label',
          generic: 'METOPROLOL SUCCINATE',
        },
      ],
      fetchBytes: bytesFor({
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22METOPROLOL%20SUCCINATE%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22&sort=effective_time%3Adesc&limit=1':
          JSON.stringify({
            results: [{ set_id: 'set-123', effective_time: '20260115' }],
          }),
        'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=metoprolol%20succinate&search=2':
          JSON.stringify({ idGroup: { rxnormId: ['221124'] } }),
        'https://rxnav.nlm.nih.gov/REST/rxcui/221124/related.json?tty=SBD':
          JSON.stringify({
            relatedGroup: {
              conceptGroup: [
                {
                  conceptProperties: [
                    {
                      name: '24 HR metoprolol succinate 25 MG Extended Release Oral Capsule [Kapspargo]',
                    },
                    {
                      name: '24 HR metoprolol succinate 50 MG Extended Release Oral Tablet [Toprol]',
                    },
                    {
                      name: '24 HR metoprolol succinate 100 MG Extended Release Oral Tablet [Toprol]',
                    },
                    {
                      name: 'hydrochlorothiazide 12.5 MG / metoprolol succinate 25 MG Extended Release Oral Tablet [Dutoprol]',
                    },
                  ],
                },
              ],
            },
          }),
        'https://rxnav.nlm.nih.gov/REST/rxclass/class/byRxcui.json?rxcui=221124&relaSource=FDASPL&relas=has_EPC':
          JSON.stringify({
            rxclassDrugInfoList: {
              rxclassDrugInfo: [
                {
                  rxclassMinConceptItem: {
                    className: 'beta-Adrenergic Blocker',
                  },
                },
              ],
            },
          }),
        'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-123&type=display':
          '<h1>1 INDICATIONS AND USAGE</h1><p>Hypertension.</p>',
      }),
    });

    expect(rows(db)).toEqual({
      documents: [
        {
          id: 'label-metoprolol-succinate',
          title: 'FDA drug label: Metoprolol succinate',
          edition: '2026',
          summary:
            'Metoprolol succinate (brands: Kapspargo, Toprol); beta-Adrenergic Blocker; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
          url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-123&type=display',
        },
      ],
      sections: [
        {
          document_id: 'label-metoprolol-succinate',
          section_id: '1-indications-and-usage',
          parent_id: null,
          position: 0,
          title: '1 INDICATIONS AND USAGE',
          page_start: null,
          page_end: null,
          content_md: 'Hypertension.',
        },
      ],
    });
  });

  it('summarizes a drug label without brands or class when rxnav has none', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [{ id: 'label-x', type: 'drug-label', generic: 'EXAMPLEMAB' }],
      fetchBytes: bytesFor({
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22EXAMPLEMAB%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22&sort=effective_time%3Adesc&limit=1':
          JSON.stringify({
            results: [{ set_id: 'set-9', effective_time: '20250301' }],
          }),
        'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=examplemab&search=2':
          JSON.stringify({ idGroup: {} }),
        'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-9&type=display':
          '<p>Label.</p>',
      }),
    });

    expect(
      db.prepare('SELECT title, edition, summary FROM documents').all(),
    ).toEqual([
      {
        title: 'FDA drug label: Examplemab',
        edition: '2025',
        summary:
          'Examplemab; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
      },
    ]);
  });

  it('leaves the previous library intact when any fetch fails', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: bytesFor({
        'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      }),
    });

    await expect(
      ingestSources({
        db,
        sources: [USPSTF, CDC_ADULT],
        fetchBytes: async (url) => {
          if (url.endsWith('.pdf')) {
            throw new Error('GET https://example.com/adult.pdf returned 503');
          }
          return new TextEncoder().encode('<h1>Changed</h1>');
        },
      }),
    ).rejects.toThrow('returned 503');

    expect(db.prepare('SELECT section_id FROM sections').all()).toEqual([
      { section_id: 'screening' },
    ]);
  });
});
