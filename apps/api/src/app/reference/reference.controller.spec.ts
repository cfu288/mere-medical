import { DatabaseSync } from 'node:sqlite';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { openReferencesDb, writeReference } from '@mere/reference-pipeline';
import { ReferenceModule } from './reference.module';

function seededDb() {
  const db = openReferencesDb(':memory:');
  writeReference(db, {
    id: 'va-dod-hypertension',
    title: 'VA-DoD Hypertension Guideline',
    edition: '2026',
    summary: 'Adults; BP goals',
    url: 'https://example.com/htn.pdf',
    sections: [
      {
        sectionId: 'ix-recommendations',
        parentId: null,
        title: 'IX. Recommendations',
        location: { kind: 'pages', start: 26, end: 26 },
        contentMd: '',
      },
      {
        sectionId: 'page-34',
        parentId: 'ix-recommendations',
        title: 'Page 34',
        location: { kind: 'pages', start: 34, end: 34 },
        contentMd: 'We recommend a systolic goal of <130 mmHg.',
      },
    ],
  });
  return db;
}

async function appWithDb(db: DatabaseSync): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [ReferenceModule],
  })
    .overrideProvider(DatabaseSync)
    .useFactory({ factory: () => db })
    .compile();
  const app = module.createNestApplication();
  await app.init();
  return app;
}

describe('ReferenceController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await appWithDb(seededDb());
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists a page of the references on file', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references?page=1',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      references: [
        {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          summary: 'Adults; BP goals',
          url: 'https://example.com/htn.pdf',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });
  });

  it('searches reference titles and summaries with repeated q terms and a page', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/search?q=kidney&q=hypertension&page=1',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      references: [
        {
          id: 'va-dod-hypertension',
          title: 'VA-DoD Hypertension Guideline',
          edition: '2026',
          summary: 'Adults; BP goals',
          url: 'https://example.com/htn.pdf',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('reads a missing or unreadable page as the first page', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/search?q=hypertension&page=abc',
    );

    expect(response.body.page).toEqual(1);
  });

  it('returns the outline of a reference', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/outline',
    );

    expect(response.status).toBe(200);
    expect(
      response.body.sections.map((s: { sectionId: string }) => s.sectionId),
    ).toEqual(['ix-recommendations']);
  });

  it('returns the outline under a section', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/outline/ix-recommendations',
    );

    expect(response.status).toBe(200);
    expect(response.body.section.sectionId).toEqual('ix-recommendations');
    expect(
      response.body.sections.map((s: { sectionId: string }) => s.sectionId),
    ).toEqual(['page-34']);
  });

  it('returns one section', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/sections/page-34',
    );

    expect(response.status).toBe(200);
    expect(response.body.reference.url).toEqual('https://example.com/htn.pdf');
    expect(response.body.section.contentMd).toEqual(
      'We recommend a systolic goal of <130 mmHg.',
    );
  });

  it('finds sections of one reference matching any repeated q term', async () => {
    const response = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/find?q=systolic&q=diastolic',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      matches: [
        {
          sectionId: 'page-34',
          title: 'Page 34',
          count: 1,
          excerpt: 'We recommend a systolic goal of <130 mmHg.',
        },
      ],
    });
  });

  it('answers 404 no-reference for an unknown reference', async () => {
    const outline = await request(app.getHttpServer()).get(
      '/v1/agent/references/nope/outline',
    );
    const section = await request(app.getHttpServer()).get(
      '/v1/agent/references/nope/sections/page-34',
    );
    const find = await request(app.getHttpServer()).get(
      '/v1/agent/references/nope/find?q=x',
    );

    expect([outline.status, section.status, find.status]).toEqual([
      404, 404, 404,
    ]);
    expect([outline.body, section.body, find.body]).toEqual([
      { error: 'no-reference' },
      { error: 'no-reference' },
      { error: 'no-reference' },
    ]);
  });

  it('answers 404 no-section for an unknown section', async () => {
    const outline = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/outline/nope',
    );
    const section = await request(app.getHttpServer()).get(
      '/v1/agent/references/va-dod-hypertension/sections/nope',
    );

    expect([outline.status, section.status]).toEqual([404, 404]);
    expect([outline.body, section.body]).toEqual([
      { error: 'no-section' },
      { error: 'no-section' },
    ]);
  });
});

describe('ReferenceModule without a references db file', () => {
  it('serves an empty library', async () => {
    const previous = process.env['REFERENCE_DB_PATH'];
    process.env['REFERENCE_DB_PATH'] = '/nonexistent/references.db';
    let response;
    try {
      const module = await Test.createTestingModule({
        imports: [ReferenceModule],
      }).compile();
      const app = module.createNestApplication();
      await app.init();
      response = await request(app.getHttpServer()).get('/v1/agent/references');
      await app.close();
    } finally {
      if (previous === undefined) {
        delete process.env['REFERENCE_DB_PATH'];
      } else {
        process.env['REFERENCE_DB_PATH'] = previous;
      }
    }

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      references: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
  });
});
