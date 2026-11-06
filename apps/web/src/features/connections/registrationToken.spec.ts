import { OAuthError } from '@mere/fhir-oauth';
import {
  registrationTokenHeaders,
  registrationTokenNeededMessage,
  isRegistrationTokenRejected,
  needsRegistrationToken,
} from './registrationToken';

function saveKey(key: string) {
  localStorage.setItem('config', JSON.stringify({ registration_token: key }));
}

describe('registrationTokenHeaders', () => {
  afterEach(() => localStorage.clear());

  it('sends the saved token', () => {
    saveKey('valid-registration-token');

    expect(registrationTokenHeaders()).toEqual({
      'X-Registration-Token': 'valid-registration-token',
    });
  });

  it('sends nothing without a saved token', () => {
    expect(registrationTokenHeaders()).toEqual({});
  });
});

describe('isRegistrationTokenRejected', () => {
  it('recognises the refusal', () => {
    expect(
      isRegistrationTokenRejected(
        new OAuthError('registration_token_rejected', 'refused'),
      ),
    ).toBe(true);
  });

  it('ignores other errors', () => {
    expect(
      isRegistrationTokenRejected(new OAuthError('invalid_grant', 'no')),
    ).toBe(false);
    expect(
      isRegistrationTokenRejected(new Error('registration_token_rejected')),
    ).toBe(false);
  });
});

describe('registrationTokenNeededMessage', () => {
  it('names the contact when the host set one', () => {
    expect(
      registrationTokenNeededMessage({
        APP_CONTACT: 'admin@mere.example',
      }),
    ).toBe(
      'To connect, open the invite link from your Mere administrator (admin@mere.example).',
    );
  });

  it('names nobody without a contact', () => {
    expect(registrationTokenNeededMessage({})).toBe(
      'To connect, open the invite link from your Mere administrator.',
    );
  });
});

describe('needsRegistrationToken', () => {
  afterEach(() => localStorage.clear());

  it.each([
    [
      'nextgen on a keyed instance',
      { REGISTRATION_TOKEN_REQUIRED: true },
      'nextgen',
      true,
    ],
    [
      'onpatient on a keyed instance',
      { REGISTRATION_TOKEN_REQUIRED: true },
      'onpatient',
      true,
    ],
    [
      'confidential healow on a keyed instance',
      { REGISTRATION_TOKEN_REQUIRED: true, HEALOW_CONFIDENTIAL_MODE: true },
      'healow',
      true,
    ],
    [
      'public healow on a keyed instance',
      { REGISTRATION_TOKEN_REQUIRED: true, HEALOW_CONFIDENTIAL_MODE: false },
      'healow',
      false,
    ],
    [
      'epic on a keyed instance',
      { REGISTRATION_TOKEN_REQUIRED: true },
      'epic',
      false,
    ],
    [
      'nextgen on an open instance',
      { REGISTRATION_TOKEN_REQUIRED: false },
      'nextgen',
      false,
    ],
    ['nextgen before the config is known', {}, 'nextgen', false],
  ] as const)('answers %s', (_name, config, source, expected) => {
    expect(needsRegistrationToken(config, source)).toBe(expected);
  });

  it('is satisfied by a saved key', () => {
    saveKey('valid-registration-token');

    expect(
      needsRegistrationToken({ REGISTRATION_TOKEN_REQUIRED: true }, 'nextgen'),
    ).toBe(false);
  });
});
