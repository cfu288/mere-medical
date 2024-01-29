import { parseDateString } from './parseCCDA';
import crypto from 'crypto';
Object.defineProperty(global.self, 'crypto', {
  value: {
    subtle: crypto.webcrypto.subtle,
  },
});
import fs from 'fs';
import path from 'path';
import { parseCCDAEncounterSection } from './parseCCDAEncounterSection';

describe('parseCCDAEncounterSection', () => {
  it('parses encounter', () => {
    const parser = new DOMParser();
    const xmlFileRaw = fs
      .readFileSync(
        path.join(
          __dirname,
          './exampleCCDA/example_encounter_outpatient_with_diagnoses.xml',
        ),
      )
      .toString();
    const xmlDoc = parser.parseFromString(xmlFileRaw, 'text/xml');
    const sections = xmlDoc.getElementsByTagName('section');

    const results = parseCCDAEncounterSection(sections, [
      '2.16.840.1.113883.10.20.22.2.22',
      '2.16.840.1.113883.10.20.22.2.22.1',
      '2.16.840.1.113883.10.20.22.4.49',
      '2.16.840.1.113883.10.20.22.4.32',
      '2.16.840.1.113883.10.20.22.4.80',
      '2.16.840.1.113883.10.20.22.4.4',
      '2.16.840.1.113883.10.20.22.4.6',
    ]);

    expect(results).not.toBeNull();
    if (results) {
      expect(results.code?.codeId).toEqual('46240-8');
      expect(results.code?.codeSystem).toEqual('2.16.840.1.113883.6.1');
      expect(results.code?.codeDisplayName).toEqual('Encounters');

      // currently parsing the code of the section but not of the encounter
      // TODO: parse the code of the encounter
      expect(results.encounterCode?.codeId).toEqual('99213');
      expect(results.encounterCode?.codeSystem).toEqual(
        '2.16.840.1.113883.6.12',
      );
      expect(results.encounterCode?.codeDisplayName).toEqual(
        'Office or other outpatient visit for the evaluation and management of an established patient, which requires a medically appropriate history and/or examination and low level of medical decision making. When using time for code selection, 20-29 minutes of total time is spent on the date of the encounter.',
      );

      expect(results.effectiveTime).toEqual('201208151000-0800');

      expect(results.performers).toHaveLength(1);
      expect(
        results.performers?.[0].assignedEntity?.assignedPerson.name.family,
      ).toEqual('Khan');
      expect(
        results.performers?.[0].assignedEntity?.assignedPerson.name.given,
      ).toEqual('Samir');
      expect(
        results.performers?.[0].assignedEntity?.assignedPerson.name.prefix,
      ).toEqual('Dr.');
      expect(results.performers?.[0].assignedEntity?.code?.code).toEqual(
        '207R00000X',
      );
      expect(results.performers?.[0].assignedEntity?.code?.codeSystem).toEqual(
        '2.16.840.1.113883.6.101',
      );
      expect(results.performers?.[0].assignedEntity?.code?.displayName).toEqual(
        'Allopathic & Osteopathic Physicians; Internal Medicine',
      );

      expect(results.participants).toHaveLength(1);
      expect(results.participants?.[0].participantRole?.code?.code).toEqual(
        '1160-1',
      );
      expect(
        results.participants?.[0].participantRole?.code?.codeSystem,
      ).toEqual('2.16.840.1.113883.6.259');
      expect(
        results.participants?.[0].participantRole?.code?.displayName,
      ).toEqual('Urgent Care Center');
      // expect(
      //   results.participants?.[0].participantRole?.code?.codeSystemName,
      // ).toEqual('HealthcareServiceLocation');
      // addr
      expect(
        results.participants?.[0].participantRole?.addr?.[0].streetAddressLine,
      ).toEqual('1004 Healthcare Dr.');
      expect(results.participants?.[0].participantRole?.addr?.[0].city).toEqual(
        'Portland',
      );
      expect(
        results.participants?.[0].participantRole?.addr?.[0].state,
      ).toEqual('OR');
      expect(
        results.participants?.[0].participantRole?.addr?.[0].postalCode,
      ).toEqual('97005');
      expect(
        results.participants?.[0].participantRole?.telecom?.[0].value,
      ).toEqual('tel:+1(555)555-1004');
      expect(
        results.participants?.[0].participantRole?.playingEntity?.name,
      ).toEqual('Get Well Clinic');

      expect(results.diagnosises).toHaveLength(1);
      expect(results.diagnosises?.[0].code).toEqual('29308-4');
      expect(results.diagnosises?.[0].codeSystem).toEqual(
        '2.16.840.1.113883.6.1',
      );
      expect(results.diagnosises?.[0].displayName).toEqual('Diagnosis');
      expect(results.diagnosises?.[0].value).toEqual('Costal chondritis');
    }
  });
});
