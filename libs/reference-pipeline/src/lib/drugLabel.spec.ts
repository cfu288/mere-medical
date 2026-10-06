import { brandNames, labelSearch, labelSpoke, labelSummary } from './drugLabel';

describe('labelSearch', () => {
  it('searches only originator labels when the route has an NDA', () => {
    expect(
      labelSearch('openfda.route.exact:"ORAL"', ['ANDA076969', 'NDA019962']),
    ).toBe('openfda.route.exact:"ORAL" AND openfda.application_number:NDA*');
  });

  it('searches every label when the route has only generic applications', () => {
    expect(
      labelSearch('openfda.route.exact:"ORAL"', ['ANDA076969', 'ANDA000002']),
    ).toBe('openfda.route.exact:"ORAL"');
  });
});

describe('labelSpoke', () => {
  it('names the spoke for the brand and states the application, maker and effective date', () => {
    expect(
      labelSpoke('ORAL', {
        set_id: 'set-123',
        effective_time: '20260115',
        openfda: {
          brand_name: ['Toprol-XL'],
          manufacturer_name: ['AstraZeneca'],
          application_number: ['NDA019962'],
        },
      }),
    ).toEqual({
      id: 'oral',
      title: 'Oral: Toprol-XL',
      url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-123&type=display',
      contentMd: 'Label NDA019962 by AstraZeneca, effective 2026-01-15.',
    });
  });

  it('names the spoke for the maker when the label has no brand', () => {
    expect(
      labelSpoke('ORAL', {
        set_id: 'set-9',
        effective_time: '20250301',
        openfda: {
          manufacturer_name: ['Example Pharma'],
          application_number: ['ANDA000002'],
        },
      }),
    ).toEqual({
      id: 'oral',
      title: 'Oral: Example Pharma',
      url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-9&type=display',
      contentMd: 'Label ANDA000002 by Example Pharma, effective 2025-03-01.',
    });
  });

  it('still describes a label with no openFDA details', () => {
    expect(
      labelSpoke('ORAL', { set_id: 'set-1', effective_time: '20240601' }),
    ).toEqual({
      id: 'oral',
      title: 'Oral: label',
      url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-1&type=display',
      contentMd: 'Label unknown, effective 2024-06-01.',
    });
  });

  it('turns a route with punctuation into a plain id and title', () => {
    expect(
      labelSpoke('RESPIRATORY (INHALATION)', {
        set_id: 'set-2',
        effective_time: '20230101',
        openfda: { brand_name: ['Ventolin HFA'] },
      }),
    ).toEqual({
      id: 'respiratory-inhalation',
      title: 'Respiratory (inhalation): Ventolin HFA',
      url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=set-2&type=display',
      contentMd: 'Label unknown, effective 2023-01-01.',
    });
  });
});

describe('brandNames', () => {
  it('lists each bracketed brand once, sorted, leaving out combination products', () => {
    expect(
      brandNames([
        '24 HR metoprolol succinate 50 MG Extended Release Oral Tablet [Toprol]',
        '24 HR metoprolol succinate 25 MG Extended Release Oral Capsule [Kapspargo]',
        '24 HR metoprolol succinate 100 MG Extended Release Oral Tablet [Toprol]',
        'hydrochlorothiazide 12.5 MG / metoprolol succinate 25 MG Extended Release Oral Tablet [Dutoprol]',
      ]),
    ).toEqual(['Kapspargo', 'Toprol']);
  });

  it('skips a product name with no bracketed brand', () => {
    expect(brandNames(['metoprolol tartrate 25 MG Oral Tablet'])).toEqual([]);
  });
});

describe('labelSummary', () => {
  it('lists brands, classes and routes', () => {
    expect(
      labelSummary({
        name: 'Metoprolol succinate',
        brands: ['Kapspargo', 'Toprol'],
        classes: ['beta-Adrenergic Blocker'],
        routes: ['ORAL', 'RESPIRATORY (INHALATION)'],
      }),
    ).toBe(
      'Metoprolol succinate (brands: Kapspargo, Toprol); beta-Adrenergic Blocker; routes: oral, respiratory inhalation; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
    );
  });

  it('leaves out brands and classes when RxNav has none', () => {
    expect(
      labelSummary({
        name: 'Examplemab',
        brands: [],
        classes: [],
        routes: ['ORAL'],
      }),
    ).toBe(
      'Examplemab; routes: oral; FDA prescribing information: uses, dosing, warnings, side effects, interactions',
    );
  });
});
