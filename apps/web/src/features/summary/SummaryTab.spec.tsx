import { render, screen } from '@testing-library/react';
import { RxDatabase } from 'rxdb';

import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import { UserProvider } from '../../app/providers/UserProvider';
import {
  ClinicalDocument,
  ClinicalDocumentResourceType,
} from '../../models/clinical-document/ClinicalDocument.type';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../test-utils/createTestDatabase';
import { TestProviders } from '../../test-utils/TestProviders';
import SummaryTab from './SummaryTab';

function record(
  metadataId: string,
  resourceType: ClinicalDocumentResourceType,
  displayName: string,
  resource: Record<string, unknown>,
): ClinicalDocument {
  return {
    id: `conn-a|user-1|${metadataId}`,
    connection_record_id: 'conn-a',
    user_id: 'user-1',
    data_record: {
      raw: { resource },
      format: 'FHIR.R4',
      content_type: 'application/json',
      resource_type: resourceType,
      version_history: [],
    },
    metadata: {
      id: metadataId,
      date: '2022-01-13T12:00:00-05:00',
      display_name: displayName,
    },
  };
}

class HiddenIntersectionObserver {
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

describe('SummaryTab', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    window.IntersectionObserver =
      HiddenIntersectionObserver as unknown as typeof IntersectionObserver;
    db = await createTestDatabase();
    await db.user_documents.insert({
      id: 'user-1',
      is_selected_user: true,
      is_default_user: true,
    });
    await db.clinical_documents.bulkInsert([
      record('med-1', 'medicationstatement', 'Metformin 500 mg', {
        resourceType: 'MedicationStatement',
      }),
      record('cond-1', 'condition', 'Type 2 diabetes', {
        resourceType: 'Condition',
      }),
      record('imm-1', 'immunization', 'Influenza vaccine', {
        resourceType: 'Immunization',
      }),
      record('allergy-1', 'allergyintolerance', 'Penicillin', {
        resourceType: 'AllergyIntolerance',
        code: { text: 'Penicillin' },
      }),
      record('careplan-1', 'careplan', 'Diabetes plan', {
        resourceType: 'CarePlan',
        addresses: [{ id: 'a1', display: 'Diabetes care' }],
        goal: [{ id: 'g1', display: 'Lower A1c below 7' }],
      }),
      record('obs-1', 'observation', 'GLUCOSE', {
        resourceType: 'Observation',
      }),
    ]);
    await db.summary_page_preferences.insert({
      id: 'prefs-1',
      user_id: 'user-1',
      pinned_labs: ['conn-a|user-1|obs-1'],
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it('shows each kind of summary record of the user', async () => {
    render(
      <TestProviders db={db}>
        <UserProvider>
          <SummaryTab />
        </UserProvider>
      </TestProviders>,
    );

    expect((await screen.findByText('Metformin 500 mg')).textContent).toBe(
      'Metformin 500 mg',
    );
    expect(screen.getByText('Type 2 diabetes').textContent).toBe(
      'Type 2 diabetes',
    );
    expect(screen.getByText('Influenza vaccine (1)').textContent).toBe(
      'Influenza vaccine (1)',
    );
    expect(screen.getByText('Penicillin').textContent).toBe('Penicillin ');
    expect(screen.getByText('- Lower A1c below 7').textContent).toBe(
      ' -    Lower A1c below 7',
    );
    expect(screen.getByText('GLUCOSE').textContent).toBe('GLUCOSE');
  });
});
