import { BundleEntry, FhirResource } from 'fhir/r2';
import { ClinicalDocument } from '../models/clinical-document/ClinicalDocument.type';
import uuid4 from '../utils/UUIDUtils';

export function createTestClinicalDocument(
  overrides?: Partial<ClinicalDocument<BundleEntry<FhirResource>>>,
): ClinicalDocument<BundleEntry<FhirResource>> {
  const resourceId = uuid4();
  return {
    id: `test-connection|test-user|${resourceId}`,
    connection_record_id: 'test-connection',
    user_id: 'test-user',
    data_record: {
      raw: {
        resource: {
          resourceType: 'Observation',
          id: resourceId,
          status: 'final',
        },
      } as BundleEntry<FhirResource>,
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: 'observation',
      version_history: [],
    },
    metadata: {
      id: resourceId,
      date: new Date().toISOString(),
      display_name: 'Test Observation',
    },
    ...overrides,
  };
}

export function createDocumentsForDays(
  userId: string,
  days: number,
  recordsPerDay: number = 10,
): ClinicalDocument<BundleEntry<FhirResource>>[] {
  const docs: ClinicalDocument<BundleEntry<FhirResource>>[] = [];
  const baseDate = new Date('2024-01-15T12:00:00Z');

  for (let d = 0; d < days; d++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString();

    for (let r = 0; r < recordsPerDay; r++) {
      const resourceId = uuid4();
      docs.push(
        createTestClinicalDocument({
          id: `test-connection|${userId}|${resourceId}`,
          user_id: userId,
          metadata: {
            id: resourceId,
            date: dateStr,
            display_name: `Document Day ${d} Record ${r}`,
          },
        }),
      );
    }
  }

  return docs;
}

export function createDocumentsWithSpecificDates(
  userId: string,
  dateRecordCounts: { date: string; count: number }[],
): ClinicalDocument<BundleEntry<FhirResource>>[] {
  const docs: ClinicalDocument<BundleEntry<FhirResource>>[] = [];

  for (const { date, count } of dateRecordCounts) {
    for (let r = 0; r < count; r++) {
      const resourceId = uuid4();
      docs.push(
        createTestClinicalDocument({
          id: `test-connection|${userId}|${resourceId}`,
          user_id: userId,
          metadata: {
            id: resourceId,
            date,
            display_name: `Document ${date} Record ${r}`,
          },
        }),
      );
    }
  }

  return docs;
}
