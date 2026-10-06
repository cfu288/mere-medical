import { fakeFetch } from './__fixtures__/fakeFetch';
import { drugLabel } from './drugLabel';

describe('drugLabel', () => {
  it('takes the originator label for a route and names brands and class from RxNav, leaving out combination products', async () => {
    expect(
      await drugLabel(
        'METOPROLOL SUCCINATE',
        fakeFetch({
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
      ),
    ).toEqual({
      title: 'FDA drug label: Metoprolol succinate',
      edition: '2026',
      summary:
        'Metoprolol succinate (brands: Kapspargo, Toprol); beta-Adrenergic Blocker; routes: oral; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
      url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=metoprolol%20succinate',
      spokes: [
        {
          id: 'oral',
          title: 'Oral: Toprol-XL',
          url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-123&type=display',
          contentMd: 'Label NDA019962 by AstraZeneca, effective 2026-01-15.',
          document: {
            kind: 'webpage',
            blocks: [
              { kind: 'heading', level: 1, text: '1 INDICATIONS AND USAGE' },
              { kind: 'text', text: 'Hypertension.' },
            ],
          },
        },
      ],
    });
  });

  it('falls back to the newest generic label and the manufacturer name when no originator label exists', async () => {
    expect(
      await drugLabel(
        'EXAMPLEMAB',
        fakeFetch({
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
      ),
    ).toEqual({
      title: 'FDA drug label: Examplemab',
      edition: '2025',
      summary:
        'Examplemab; routes: oral; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
      url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=examplemab',
      spokes: [
        {
          id: 'oral',
          title: 'Oral: Example Pharma',
          url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-9&type=display',
          contentMd:
            'Label ANDA000002 by Example Pharma, effective 2025-03-01.',
          document: {
            kind: 'webpage',
            blocks: [{ kind: 'text', text: 'Label.' }],
          },
        },
      ],
    });
  });

  it('gives each route its own spoke and dates the label by its newest spoke', async () => {
    expect(
      await drugLabel(
        'ESTRADIOL',
        fakeFetch({
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
      ),
    ).toEqual({
      title: 'FDA drug label: Estradiol',
      edition: '2026',
      summary:
        'Estradiol; routes: oral, transdermal; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
      url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=estradiol',
      spokes: [
        {
          id: 'oral',
          title: 'Oral: Estradiol',
          url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-o&type=display',
          contentMd: 'Label ANDA000003 by Generic Co, effective 2024-06-01.',
          document: {
            kind: 'webpage',
            blocks: [
              {
                kind: 'heading',
                level: 1,
                text: '2 DOSAGE AND ADMINISTRATION',
              },
              { kind: 'text', text: 'One tablet daily.' },
            ],
          },
        },
        {
          id: 'transdermal',
          title: 'Transdermal: Minivelle',
          url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-t&type=display',
          contentMd:
            'Label NDA203752 by Noven Therapeutics, LLC, effective 2026-07-31.',
          document: {
            kind: 'webpage',
            blocks: [
              {
                kind: 'heading',
                level: 1,
                text: '2 DOSAGE AND ADMINISTRATION',
              },
              { kind: 'text', text: 'Apply twice weekly.' },
            ],
          },
        },
      ],
    });
  });
});
