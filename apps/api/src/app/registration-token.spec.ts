import { registrationToken } from './registration-token';

describe('registrationToken', () => {
  it('signs a fixed label with the app key', () => {
    expect(registrationToken('valid-app-key-for-the-test-suite')).toBe(
      '3ebnq9Avix4S-QZ4rLC47V-crei4F3IT7PqAOFSlCeA',
    );
  });
});
