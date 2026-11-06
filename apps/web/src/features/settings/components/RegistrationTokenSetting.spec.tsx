import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RxDatabase } from 'rxdb';
import { DatabaseCollections } from '../../../app/providers/DatabaseCollections';
import { AppConfigProvider } from '../../../app/providers/AppConfigProvider';
import {
  LocalConfigProvider,
  useUpdateLocalConfig,
} from '../../../app/providers/LocalConfigProvider';
import { TestProviders } from '../../../test-utils/TestProviders';
import {
  cleanupTestDatabase,
  createTestDatabase,
} from '../../../test-utils/createTestDatabase';
import { RegistrationTokenSetting } from './RegistrationTokenSetting';

function InviteLinkStandIn() {
  const updateLocalConfig = useUpdateLocalConfig();
  return (
    <button
      type="button"
      onClick={() =>
        updateLocalConfig({ registration_token: 'rotated-registration-token' })
      }
    >
      Open new invite link
    </button>
  );
}

function renderSetting(
  db: RxDatabase<DatabaseCollections>,
  required: boolean,
  contact?: string,
) {
  return render(
    <LocalConfigProvider>
      <TestProviders db={db}>
        <AppConfigProvider
          configFetcher={async () => ({
            PUBLIC_URL: 'https://mere.example',
            REGISTRATION_TOKEN_REQUIRED: required,
            APP_CONTACT: contact,
          })}
        >
          <ul>
            <RegistrationTokenSetting />
          </ul>
          <InviteLinkStandIn />
          <span>Ready</span>
        </AppConfigProvider>
      </TestProviders>
    </LocalConfigProvider>,
  );
}

describe('RegistrationTokenSetting', () => {
  let db: RxDatabase<DatabaseCollections>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    localStorage.clear();
    await cleanupTestDatabase(db);
  });

  it('explains which vendors need the token and how to get it', async () => {
    renderSetting(db, true);

    await screen.findByText(
      'Some vendors, such as Healow, NextGen, and OnPatient, need a registration token to connect. Opening the invite link from your Mere administrator sets it.',
    );
  });

  it('names the contact the host configured', async () => {
    renderSetting(db, true, 'admin@mere.example');

    await screen.findByText(/your Mere administrator \(admin@mere\.example\)/);
  });

  it('says when this browser has no token', async () => {
    renderSetting(db, true);

    await screen.findByText('This browser has no registration token yet.');
  });

  it('says when this browser has a token, without showing it', async () => {
    localStorage.setItem(
      'config',
      JSON.stringify({ registration_token: 'saved-registration-token' }),
    );
    renderSetting(db, true);

    await screen.findByText('This browser has a registration token.');
    expect(screen.queryByText(/saved-registration-token/)).toBeNull();
  });

  it('offers no field to edit the token', async () => {
    renderSetting(db, true);

    await screen.findByText('This browser has no registration token yet.');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('shows a token saved by an invite link while the page is open', async () => {
    renderSetting(db, true);
    await screen.findByText('This browser has no registration token yet.');

    fireEvent.click(screen.getByText('Open new invite link'));

    await screen.findByText('This browser has a registration token.');
  });

  it('renders nothing on an open instance without a saved token', async () => {
    renderSetting(db, false);

    await screen.findByText('Ready');
    await waitFor(() => {
      expect(screen.queryByText('Registration token')).toBeNull();
    });
  });

  it('renders nothing on an open instance with a saved token', async () => {
    localStorage.setItem(
      'config',
      JSON.stringify({ registration_token: 'saved-registration-token' }),
    );
    renderSetting(db, false);

    await screen.findByText('Ready');
    await waitFor(() => {
      expect(screen.queryByText('Registration token')).toBeNull();
    });
  });
});
