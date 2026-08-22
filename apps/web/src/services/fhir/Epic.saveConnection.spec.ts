import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../app/providers/DatabaseCollections';
import {
  createTestDatabase,
  cleanupTestDatabase,
} from '../../test-utils/createTestDatabase';
import { createTestUser } from '../../test-utils/userTestData';
import { UserDocument } from '../../models/user-document/UserDocument.type';
import { saveConnectionToDb } from './Epic';
import * as connectionRepo from '../../repositories/ConnectionRepository';

const UCSF_SHARED_URL =
  'https://unified-api.ucsf.edu/clinical/apex/api/FHIR/DSTU2/';
const UCSF_AUTH_URL =
  'https://unified-api.ucsf.edu/clinical/apex/oauth2/authorize';
const UCSF_TOKEN_URL =
  'https://unified-api.ucsf.edu/clinical/apex/oauth2/token';

const UCSF_HEALTH_ID = 'cc9e0f4c-9813-e911-9126-001dd8b71f19';
const UCSF_BENIOFF_ID = 'cd9e0f4c-9813-e911-9126-001dd8b71f19';

describe('saveConnectionToDb', () => {
  let db: RxDatabase<DatabaseCollections>;
  let user: UserDocument;

  beforeEach(async () => {
    db = await createTestDatabase();
    user = createTestUser();
    await db.user_documents.insert(user);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  const connect = (
    epicId: string,
    epicName: string,
    patient: string,
    token = `token-for-${patient}`,
  ) =>
    saveConnectionToDb({
      res: {
        access_token: token,
        expires_in: 3600,
        patient,
        token_type: 'Bearer',
        scope: 'patient/*.read',
        refresh_token: `refresh-for-${patient}`,
      },
      epicBaseUrl: UCSF_SHARED_URL,
      epicTokenUrl: UCSF_TOKEN_URL,
      epicAuthUrl: UCSF_AUTH_URL,
      epicName,
      db,
      epicId,
      user,
      fhirVersion: 'DSTU2',
    });

  it('keeps two tenants that publish the same fhir base url as separate connections', async () => {
    await connect(UCSF_HEALTH_ID, 'UCSF Health', 'patient-health');
    await connect(
      UCSF_BENIOFF_ID,
      "UCSF Benioff Children's Hospital",
      'patient-benioff',
    );

    const connections = await connectionRepo.findAllConnections(db, user.id);

    expect(connections).toHaveLength(2);
  });

  it('preserves the first tenant when a second tenant on the same url connects', async () => {
    await connect(UCSF_HEALTH_ID, 'UCSF Health', 'patient-health');
    await connect(
      UCSF_BENIOFF_ID,
      "UCSF Benioff Children's Hospital",
      'patient-benioff',
    );

    const connections = await connectionRepo.findAllConnections(db, user.id);
    const health = connections.find((c) => c.tenant_id === UCSF_HEALTH_ID);

    expect(health?.name).toBe('UCSF Health');
    expect(health?.patient).toBe('patient-health');
    expect(health?.access_token).toBe('token-for-patient-health');
  });

  it('refreshes credentials in place when the same tenant reconnects', async () => {
    await connect(UCSF_HEALTH_ID, 'UCSF Health', 'patient-health', 'stale');
    await connect(UCSF_HEALTH_ID, 'UCSF Health', 'patient-health', 'fresh');

    const connections = await connectionRepo.findAllConnections(db, user.id);

    expect(connections).toHaveLength(1);
    expect(connections[0].patient).toBe('patient-health');
    expect(connections[0].access_token).toBe('fresh');
  });
});
