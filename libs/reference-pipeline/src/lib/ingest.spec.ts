import { fakeFetch } from './__fixtures__/fakeFetch';
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

describe('ingestSources', () => {
  it('stores an html source with its configured description and its section tree, reporting the outline and dropped sections', async () => {
    const db = openReferencesDb(':memory:');
    const report = await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab':
          '<h1>Screening</h1><p>Screen adults.</p><h2>Hypertension</h2><p>Measure blood pressure.</p><h1>References</h1><p>1. Smith.</p>',
      }),
    });

    expect(
      db
        .prepare('SELECT id, title, edition, summary, url FROM documents')
        .all(),
    ).toEqual([
      {
        id: 'uspstf-a-and-b',
        title: 'USPSTF A and B Recommendations',
        edition: 'Updated continuously',
        summary: 'Screening and prevention',
        url: 'https://example.com/ab',
      },
    ]);
    expect(
      db
        .prepare('SELECT section_id, parent_id FROM sections ORDER BY position')
        .all(),
    ).toEqual([
      { section_id: 'screening', parent_id: null },
      { section_id: 'hypertension', parent_id: 'screening' },
    ]);
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
      fetchBytes: fakeFetch({ 'https://example.com/adult.pdf': TWO_SIZE_PDF }),
    });

    expect(
      db.prepare('SELECT section_id, page_start, page_end FROM sections').all(),
    ).toEqual([{ section_id: 'i-introduction', page_start: 1, page_end: 1 }]);
  });

  it('stores a cdc media source under the cdc page it syndicates and skips a second media id for the same page', async () => {
    const db = openReferencesDb(':memory:');

    const report = await ingestSources({
      db,
      sources: [
        {
          id: 'cdc-about-shingles',
          title: 'CDC: About Shingles',
          edition: '2025',
          summary: 'Shingles basics',
          type: 'cdc-media',
          mediaId: 1,
        },
        {
          id: 'cdc-about-shingles-2',
          title: 'CDC: About Shingles',
          edition: '2025',
          summary: 'Shingles basics',
          type: 'cdc-media',
          mediaId: 2,
        },
      ],
      fetchBytes: fakeFetch({
        'https://tools.cdc.gov/api/v2/resources/media/1.json':
          '{"results":[{"sourceUrl":"https://www.cdc.gov/shingles/about/index.html"}]}',
        'https://tools.cdc.gov/api/v2/resources/media/1/content.html':
          '<h2>About</h2><p>Shingles is a painful rash.</p>',
        'https://tools.cdc.gov/api/v2/resources/media/2.json':
          '{"results":[{"sourceUrl":"https://www.cdc.gov/shingles/about/index.html"}]}',
        'https://tools.cdc.gov/api/v2/resources/media/2/content.html':
          '<h2>About</h2><p>Shingles is a painful rash.</p>',
      }),
    });

    expect(db.prepare('SELECT id, url FROM documents').all()).toEqual([
      {
        id: 'cdc-about-shingles',
        url: 'https://www.cdc.gov/shingles/about/index.html',
      },
    ]);
    expect(report.skipped).toEqual([
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
    const fetchBytes = fakeFetch({
      'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      'https://example.com/adult': '<h1>Adults</h1><p>Tdap every 10 years.</p>',
    });
    await ingestSources({ db, sources: [USPSTF, adultPage], fetchBytes });
    await ingestSources({ db, sources: [adultPage], fetchBytes });

    expect(db.prepare('SELECT id FROM documents').all()).toEqual([
      { id: 'cdc-adult-schedule' },
    ]);
    expect(
      db.prepare('SELECT DISTINCT document_id FROM sections').all(),
    ).toEqual([{ document_id: 'cdc-adult-schedule' }]);
  });

  it('reports a reference it could not add when its source parses to nothing on a first run', async () => {
    const db = openReferencesDb(':memory:');

    const report = await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: fakeFetch({ 'https://example.com/ab': '' }),
    });

    expect(report.missing).toEqual(['uspstf-a-and-b']);
    expect(report.unchanged).toEqual([]);
    expect(db.prepare('SELECT id FROM documents').all()).toEqual([]);
  });

  it('still reports the dropped sections of a source that parsed to nothing', async () => {
    const db = openReferencesDb(':memory:');

    const report = await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab': '<h1>References</h1><p>1. Smith 2020.</p>',
      }),
    });

    expect(report.references).toEqual([
      { id: 'uspstf-a-and-b', outline: [], dropped: ['References'] },
    ]);
    expect(report.missing).toEqual(['uspstf-a-and-b']);
  });

  it('keeps a reference as it was when its source now parses to nothing', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      }),
    });

    const report = await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: fakeFetch({ 'https://example.com/ab': '' }),
    });

    expect(report.unchanged).toEqual(['uspstf-a-and-b']);
    expect(db.prepare('SELECT section_id FROM sections').all()).toEqual([
      { section_id: 'screening' },
    ]);
  });

  it('leaves the previous library intact when any fetch fails', async () => {
    const db = openReferencesDb(':memory:');
    await ingestSources({
      db,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      }),
    });

    await expect(
      ingestSources({
        db,
        sources: [USPSTF, CDC_ADULT],
        fetchBytes: fakeFetch({ 'https://example.com/ab': '<h1>Changed</h1>' }),
      }),
    ).rejects.toThrow('no fake body for https://example.com/adult.pdf');

    expect(db.prepare('SELECT section_id FROM sections').all()).toEqual([
      { section_id: 'screening' },
    ]);
  });
});
