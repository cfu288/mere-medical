import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { fakeFetch } from './__fixtures__/fakeFetch';
import { TWO_SIZE_PDF } from './__fixtures__/twoSizePdf';
import { buildLibrary } from './ingest';
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

function libraryPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'references-')), 'references.db');
}

describe('buildLibrary', () => {
  it('stores an html source with its configured description and its section tree, reporting the outline and dropped sections', async () => {
    const path = libraryPath();
    const report = await buildLibrary({
      path,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab':
          '<h1>Screening</h1><p>Screen adults.</p><h2>Hypertension</h2><p>Measure blood pressure.</p><h1>References</h1><p>1. Smith.</p>',
      }),
    });
    const db = openReferencesDb(path);

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
    expect(report).toEqual([
      {
        id: 'uspstf-a-and-b',
        status: 'written',
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
    ]);
  });

  it('stores a pdf source with page locations', async () => {
    const path = libraryPath();
    await buildLibrary({
      path,
      sources: [CDC_ADULT],
      fetchBytes: fakeFetch({ 'https://example.com/adult.pdf': TWO_SIZE_PDF }),
    });

    expect(
      openReferencesDb(path)
        .prepare('SELECT section_id, page_start, page_end FROM sections')
        .all(),
    ).toEqual([{ section_id: 'i-introduction', page_start: 1, page_end: 1 }]);
  });

  it('stores a cdc media source under the cdc page it syndicates', async () => {
    const path = libraryPath();
    await buildLibrary({
      path,
      sources: [
        {
          id: 'cdc-about-shingles',
          title: 'CDC: About Shingles',
          edition: '2025',
          summary: 'Shingles basics',
          type: 'cdc-media',
          mediaId: 1,
        },
      ],
      fetchBytes: fakeFetch({
        'https://tools.cdc.gov/api/v2/resources/media/1.json':
          '{"results":[{"sourceUrl":"https://www.cdc.gov/shingles/about/index.html"}]}',
        'https://tools.cdc.gov/api/v2/resources/media/1/content.html':
          '<h2>About</h2><p>Shingles is a painful rash.</p>',
      }),
    });

    expect(
      openReferencesDb(path).prepare('SELECT id, url FROM documents').all(),
    ).toEqual([
      {
        id: 'cdc-about-shingles',
        url: 'https://www.cdc.gov/shingles/about/index.html',
      },
    ]);
  });

  it('replaces the previous library with one holding only the configured sources', async () => {
    const path = libraryPath();
    const adultPage: Source = {
      ...CDC_ADULT,
      type: 'html',
      url: 'https://example.com/adult',
    };
    const fetchBytes = fakeFetch({
      'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      'https://example.com/adult': '<h1>Adults</h1><p>Tdap every 10 years.</p>',
    });
    await buildLibrary({ path, sources: [USPSTF, adultPage], fetchBytes });
    await buildLibrary({ path, sources: [adultPage], fetchBytes });

    expect(
      openReferencesDb(path)
        .prepare('SELECT document_id, section_id FROM sections')
        .all(),
    ).toEqual([{ document_id: 'cdc-adult-schedule', section_id: 'adults' }]);
  });

  it('reports a source that parses to nothing, with its dropped sections, and stores nothing for it', async () => {
    const path = libraryPath();

    const report = await buildLibrary({
      path,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab': '<h1>References</h1><p>1. Smith 2020.</p>',
      }),
    });

    expect(report).toEqual([
      { id: 'uspstf-a-and-b', status: 'empty', dropped: ['References'] },
    ]);
    expect(
      openReferencesDb(path).prepare('SELECT id FROM documents').all(),
    ).toEqual([]);
  });

  it('leaves the previous library as it was when any fetch fails', async () => {
    const path = libraryPath();
    await buildLibrary({
      path,
      sources: [USPSTF],
      fetchBytes: fakeFetch({
        'https://example.com/ab': '<h1>Screening</h1><p>Screen adults.</p>',
      }),
    });

    await expect(
      buildLibrary({
        path,
        sources: [USPSTF, CDC_ADULT],
        fetchBytes: fakeFetch({ 'https://example.com/ab': '<h1>Changed</h1>' }),
      }),
    ).rejects.toThrow('no fake body for https://example.com/adult.pdf');

    expect([
      openReferencesDb(path).prepare('SELECT section_id FROM sections').all(),
      existsSync(`${path}.building`),
    ]).toEqual([[{ section_id: 'screening' }], false]);
  });
});
