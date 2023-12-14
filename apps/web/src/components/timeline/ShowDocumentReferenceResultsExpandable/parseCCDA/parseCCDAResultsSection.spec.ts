import { parseDateString } from './parseCCDA';
import crypto from 'crypto';
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
  },
});
import fs from 'fs';
import path from 'path';
import { parseCCDAResultsSection } from './parseCCDAResultsSection';
import exp from 'constants';

describe('parseCCDAResultsSection', () => {
  it('parses covid result positive section', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(__dirname, './exampleCCDA/example_result_covid_positive.xml')
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe(
      'SARS-CoV-2 (COVID-19) RNA panel - Respiratory specimen by NAA with probe detection'
    );

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('202003221426-0500')).toBe(true);

    expect(results?.[0]?.data['94500-6'].title).toBe(
      'SARS-CoV-2 (COVID-19) RNA [Presence] in Respiratory specimen by NAA with probe detection'
    );
    expect(results?.[0]?.data['94500-6'].value).toBe('Detected');
    expect(results?.[0]?.data['94500-6'].unit).toBe('');
    expect(results?.[0]?.data['94500-6'].datetime).toBe('202003221426-0500');
    expect(results?.[0]?.data['94500-6'].referenceRangeText).toBe(
      'Reference (Normal) for this test is not detected'
    );
  });

  it('parses panel with coded values of negative-positive', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_result_panel_with_coded_values_of_negative_positive.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe(
      'Chlamydia trachomatis and Neisseria gonorrhoeae rRNA panel - Urine by NAA with probe detection'
    );

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('201310221426-0500')).toBe(true);

    expect(results?.[0]?.data['42931-6'].title).toBe(
      'Chlamydia trachomatis rRNA [Presence] in Urine by NAA with probe detection'
    );
    expect(results?.[0]?.data['42931-6'].value).toBe('Negative');
    expect(results?.[0]?.data['42931-6'].unit).toBe('');
    expect(results?.[0]?.data['42931-6'].datetime).toBe('201310221426-0500');
    expect(results?.[0]?.data['42931-6'].referenceRangeText).toBe(
      'A negative value is a normal result'
    );

    expect(results?.[0]?.data['60256-5'].title).toBe(
      'Neisseria gonorrhoeae rRNA [Presence] in Urine by NAA with probe detection'
    );
    expect(results?.[0]?.data['60256-5'].value).toBe('Positive');
    expect(results?.[0]?.data['60256-5'].unit).toBe('');
    expect(results?.[0]?.data['60256-5'].datetime).toBe('201310221426-0500');
    expect(results?.[0]?.data['60256-5'].referenceRangeText).toBe(
      'A negative value is a normal result'
    );
  });

  it('parses result with with multiple reference ranges', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_result_with_multiple_reference_ranges.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe(
      'Nuclear Ab [Titer] in Serum by Immunofluorescence'
    );

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('201703191230-0800')).toBe(true);

    expect(results?.[0]?.data['5048-4'].title).toBe(
      'Nuclear Ab [Titer] in Serum by Immunofluorescence'
    );
    expect(results?.[0]?.data['5048-4'].value).toBe(
      'Borderline, equal to 1:80'
    );
    expect(results?.[0]?.data['5048-4'].unit).toBe('');
    expect(results?.[0]?.data['5048-4'].datetime).toBe('201703191230-0800');
    expect(results?.[0]?.data['5048-4'].referenceRangeText).toBe(
      'Negative, less than 1:80'
    );
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems.length).toBe(3);
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems).toContain(
      'Borderline, equal to 1:80'
    );
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems).toContain(
      'Negative, less than 1:80'
    );
    expect(results?.[0]?.data['5048-4'].referenceRangeTextItems).toContain(
      'Positive, greater than 1:80'
    );
  });

  it('parses result with an unstructured string as value urine color', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_result_with_an_unstructured_string_as_value.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe('Urinalysis complete pnl Ur');

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('20131023090823-0500')).toBe(true);

    expect(results?.[0]?.data['5778-6'].title).toBe('Color of Urine');
    expect(results?.[0]?.data['5778-6'].value).toBe('Amber');
    expect(results?.[0]?.data['5778-6'].unit).toBe('');
    expect(results?.[0]?.data['5778-6'].datetime).toBe('20131023090823-0500');
    expect(results?.[0]?.data['5778-6'].referenceRangeText).toBe('');
    expect(results?.[0]?.data['5778-6'].referenceRangeTextItems.length).toBe(0);
  });

  it('parses results radiology with image narrative', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_results_radiology_with_image_narrative.xml'
        )
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAResultsSection(sections, [
      '2.16.840.1.113883.10.20.22.2.3',
      '2.16.840.1.113883.10.20.22.2.3.1',
    ]);

    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);

    expect(results?.[0]?.title).toBe('Chest X-Ray 2 Views');

    expect(results?.[0]?.uniqueDates.size).toBe(1);
    expect(results?.[0]?.uniqueDates.has('20150225091059-0500')).toBe(true);

    expect(results?.[0]?.data['36643-5'].title).toBe('XR Chest 2 Views');
    expect(results?.[0]?.data['36643-5'].value!.replace(/\s+/g, ' ')).toBe(
      `The lungs are clear. The heart is enlarged with evidence of
                                        cardiomegaly.
                                        Pulmonary vasculature is normal. The aorta is mildly ectatic and
                                        tortuous.
                                        IMPRESSION: Cardiomegaly. No other acute abnormality.`.replace(
        /\s+/g,
        ' '
      )
    );
    expect(results?.[0]?.data['36643-5'].unit).toBe('');
    expect(results?.[0]?.data['36643-5'].datetime).toBe('20150225091059-0500');
    expect(results?.[0]?.data['36643-5'].referenceRangeText).toBe('');
    expect(results?.[0]?.data['36643-5'].referenceRangeTextItems.length).toBe(
      0
    );
  });
});
