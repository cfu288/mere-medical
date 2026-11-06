import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { REGISTRATION_ACCESS } from '../proxy.constants';
import {
  RegistrationAccess,
  serverVendorConfig,
} from '../../vendor-config.server';

export const registrationAccessProvider = {
  provide: REGISTRATION_ACCESS,
  useFactory: () => serverVendorConfig().registrationAccess,
};

function registrationTokenRejected(contact: string | undefined) {
  const administrator = contact
    ? `your Mere administrator (${contact})`
    : 'your Mere administrator';
  return {
    error: 'registration_token_rejected',
    error_description: `Your invite link does not work for this Mere app. Ask ${administrator} for a new one.`,
  };
}

/**
 * On a keyed instance, lets a request through only when its X-Registration-Token
 * header equals the token signed by the app key. Open and public instances let everything through.
 */
@Injectable()
export class RegistrationTokenGuard implements CanActivate {
  constructor(
    @Inject(REGISTRATION_ACCESS) private readonly access: RegistrationAccess,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.access.mode !== 'keyed') {
      return true;
    }
    const header = context
      .switchToHttp()
      .getRequest<Request>()
      .get('X-Registration-Token');
    const provided = Buffer.from(header ?? '');
    const expected = Buffer.from(this.access.token);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException(
        registrationTokenRejected(this.access.contact),
      );
    }
    return true;
  }
}
