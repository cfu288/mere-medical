import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin || request.headers.referer;
    const allowedOrigin = process.env.PUBLIC_URL;

    if (!origin || !allowedOrigin) {
      return false;
    }

    try {
      return new URL(origin).origin === new URL(allowedOrigin).origin;
    } catch {
      return false;
    }
  }
}
