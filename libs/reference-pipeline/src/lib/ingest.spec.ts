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
          url: null,
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
          url: null,
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
      unchanged: [],
      missing: [],
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
        url: null,
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
          url: null,
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

  it('stores a drug label as one node per generic with a spoke per route, the originator label first', async () => {
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
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22METOPROLOL%20SUCCINATE%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22&count=openfda.route.exact':
          JSON.stringify({ results: [{ term: 'ORAL', count: 12 }] }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22METOPROLOL%20SUCCINATE%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22ORAL%22&count=openfda.application_number.exact':
          JSON.stringify({
            results: [
              { term: 'ANDA076969', count: 11 },
              { term: 'NDA019962', count: 1 },
            ],
          }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22METOPROLOL%20SUCCINATE%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22ORAL%22%20AND%20openfda.application_number%3ANDA*&sort=effective_time%3Adesc&limit=1':
          JSON.stringify({
            results: [
              {
                set_id: 'set-123',
                effective_time: '20260115',
                openfda: {
                  brand_name: ['Toprol-XL'],
                  manufacturer_name: ['AstraZeneca'],
                  application_number: ['NDA019962'],
                },
              },
            ],
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
            'Metoprolol succinate (brands: Kapspargo, Toprol); beta-Adrenergic Blocker; routes: oral; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
          url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=metoprolol%20succinate',
        },
      ],
      sections: [
        {
          document_id: 'label-metoprolol-succinate',
          section_id: 'oral',
          parent_id: null,
          position: 0,
          title: 'Oral: Toprol-XL',
          page_start: null,
          page_end: null,
          url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-123&type=display',
          content_md: 'Label NDA019962 by AstraZeneca, effective 2026-01-15.',
        },
        {
          document_id: 'label-metoprolol-succinate',
          section_id: 'oral-1-indications-and-usage',
          parent_id: 'oral',
          position: 1,
          title: '1 INDICATIONS AND USAGE',
          page_start: null,
          page_end: null,
          url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-123&type=display',
          content_md: 'Hypertension.',
        },
      ],
    });
  });

  it('falls back to the newest generic label and the manufacturer name when no originator label exists', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [{ id: 'label-x', type: 'drug-label', generic: 'EXAMPLEMAB' }],
      fetchBytes: bytesFor({
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22EXAMPLEMAB%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22&count=openfda.route.exact':
          JSON.stringify({ results: [{ term: 'ORAL', count: 2 }] }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22EXAMPLEMAB%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22ORAL%22&count=openfda.application_number.exact':
          JSON.stringify({ results: [{ term: 'ANDA000002', count: 2 }] }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22EXAMPLEMAB%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22ORAL%22&sort=effective_time%3Adesc&limit=1':
          JSON.stringify({
            results: [
              {
                set_id: 'set-9',
                effective_time: '20250301',
                openfda: {
                  manufacturer_name: ['Example Pharma'],
                  application_number: ['ANDA000002'],
                },
              },
            ],
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
          'Examplemab; routes: oral; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
      },
    ]);
    expect(
      db
        .prepare(
          'SELECT section_id, title, content_md FROM sections ORDER BY position',
        )
        .all(),
    ).toEqual([
      {
        section_id: 'oral',
        title: 'Oral: Example Pharma',
        content_md: 'Label ANDA000002 by Example Pharma, effective 2025-03-01.',
      },
      {
        section_id: 'oral-opening-text',
        title: 'Opening text',
        content_md: 'Label.',
      },
    ]);
  });

  it('stores one spoke per route for a drug sold in several forms', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [
        { id: 'label-estradiol', type: 'drug-label', generic: 'ESTRADIOL' },
      ],
      fetchBytes: bytesFor({
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22ESTRADIOL%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22&count=openfda.route.exact':
          JSON.stringify({
            results: [
              { term: 'TRANSDERMAL', count: 5 },
              { term: 'ORAL', count: 3 },
            ],
          }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22ESTRADIOL%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22ORAL%22&count=openfda.application_number.exact':
          JSON.stringify({ results: [{ term: 'ANDA000003', count: 3 }] }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22ESTRADIOL%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22ORAL%22&sort=effective_time%3Adesc&limit=1':
          JSON.stringify({
            results: [
              {
                set_id: 'set-o',
                effective_time: '20240601',
                openfda: {
                  brand_name: ['Estradiol'],
                  manufacturer_name: ['Generic Co'],
                  application_number: ['ANDA000003'],
                },
              },
            ],
          }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22ESTRADIOL%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22TRANSDERMAL%22&count=openfda.application_number.exact':
          JSON.stringify({
            results: [
              { term: 'ANDA000004', count: 4 },
              { term: 'NDA203752', count: 1 },
            ],
          }),
        'https://api.fda.gov/drug/label.json?search=openfda.generic_name.exact%3A%22ESTRADIOL%22%20AND%20openfda.product_type.exact%3A%22HUMAN%20PRESCRIPTION%20DRUG%22%20AND%20openfda.route.exact%3A%22TRANSDERMAL%22%20AND%20openfda.application_number%3ANDA*&sort=effective_time%3Adesc&limit=1':
          JSON.stringify({
            results: [
              {
                set_id: 'set-t',
                effective_time: '20260731',
                openfda: {
                  brand_name: ['Minivelle'],
                  manufacturer_name: ['Noven Therapeutics, LLC'],
                  application_number: ['NDA203752'],
                },
              },
            ],
          }),
        'https://rxnav.nlm.nih.gov/REST/rxcui.json?name=estradiol&search=2':
          JSON.stringify({ idGroup: {} }),
        'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-o&type=display':
          '<h1>2 DOSAGE AND ADMINISTRATION</h1><p>One tablet daily.</p>',
        'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-t&type=display':
          '<h1>2 DOSAGE AND ADMINISTRATION</h1><p>Apply twice weekly.</p>',
      }),
    });

    expect(
      db.prepare('SELECT edition, summary, url FROM documents').all(),
    ).toEqual([
      {
        edition: '2026',
        summary:
          'Estradiol; routes: oral, transdermal; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
        url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=estradiol',
      },
    ]);
    expect(
      db
        .prepare(
          'SELECT section_id, parent_id, title, url, content_md FROM sections ORDER BY position',
        )
        .all(),
    ).toEqual([
      {
        section_id: 'oral',
        parent_id: null,
        title: 'Oral: Estradiol',
        url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-o&type=display',
        content_md: 'Label ANDA000003 by Generic Co, effective 2024-06-01.',
      },
      {
        section_id: 'oral-2-dosage-and-administration',
        parent_id: 'oral',
        title: '2 DOSAGE AND ADMINISTRATION',
        url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-o&type=display',
        content_md: 'One tablet daily.',
      },
      {
        section_id: 'transdermal',
        parent_id: null,
        title: 'Transdermal: Minivelle',
        url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-t&type=display',
        content_md:
          'Label NDA203752 by Noven Therapeutics, LLC, effective 2026-07-31.',
      },
      {
        section_id: 'transdermal-2-dosage-and-administration',
        parent_id: 'transdermal',
        title: '2 DOSAGE AND ADMINISTRATION',
        url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-t&type=display',
        content_md: 'Apply twice weekly.',
      },
    ]);
  });

  it('reports a reference it could not add when its source parses to nothing on a first run', async () => {
    const db = openReferencesDb(':memory:');

    const report = await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: bytesFor({ 'https://example.com/ab': '' }),
    });

    expect(report.missing).toEqual([USPSTF.id]);
    expect(report.unchanged).toEqual([]);
    expect(db.prepare('SELECT id FROM documents').all()).toEqual([]);
  });

  it('keeps a reference as it was when its source now parses to nothing', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: bytesFor({
        'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      }),
    });

    const report = await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: bytesFor({ 'https://example.com/ab': '' }),
    });

    expect(report.unchanged).toEqual([USPSTF.id]);
    expect(db.prepare('SELECT section_id FROM sections').all()).toEqual([
      { section_id: 'screening' },
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
