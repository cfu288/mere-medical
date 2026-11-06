import { ExecutionContext } from '@nestjs/common';
import { RegistrationTokenGuard } from './registration-token.guard';

function contextWithHeader(value: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ get: () => value }),
    }),
  } as unknown as ExecutionContext;
}

describe('RegistrationTokenGuard', () => {
  it('names the contact in the refusal when one is configured', () => {
    const guard = new RegistrationTokenGuard({
      mode: 'keyed',
      token: 'valid-registration-token',
      contact: 'admin@mere.example',
    });

    expect(() =>
      guard.canActivate(contextWithHeader('wrong-registration-token')),
    ).toThrow(
      expect.objectContaining({
        response: {
          error: 'registration_token_rejected',
          error_description:
            'Your invite link does not work for this Mere app. Ask your Mere administrator (admin@mere.example) for a new one.',
        },
      }),
    );
  });

  it('refuses without naming anyone when no contact is configured', () => {
    const guard = new RegistrationTokenGuard({
      mode: 'keyed',
      token: 'valid-registration-token',
    });

    expect(() => guard.canActivate(contextWithHeader(undefined))).toThrow(
      expect.objectContaining({
        response: {
          error: 'registration_token_rejected',
          error_description:
            'Your invite link does not work for this Mere app. Ask your Mere administrator for a new one.',
        },
      }),
    );
  });

  it('lets the right token through', () => {
    const guard = new RegistrationTokenGuard({
      mode: 'keyed',
      token: 'valid-registration-token',
    });

    expect(
      guard.canActivate(contextWithHeader('valid-registration-token')),
    ).toBe(true);
  });
});
