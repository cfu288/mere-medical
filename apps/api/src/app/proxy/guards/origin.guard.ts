import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PublicUrlConfig } from '@mere/shared';
import { ALLOWED_ORIGIN } from '../proxy.constants';

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    @Inject(ALLOWED_ORIGIN) private readonly allowedOrigin: PublicUrlConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin || request.headers.referer;

    if (!origin || this.allowedOrigin.status !== 'configured') {
      return false;
    }

    try {
      return new URL(origin).origin === this.allowedOrigin.origin;
    } catch {
      return false;
    }
  }
}
