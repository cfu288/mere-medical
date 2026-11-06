import { createHmac } from 'node:crypto';

export function registrationToken(key: string): string {
  return createHmac('sha256', key)
    .update('mere-registration-token')
    .digest('base64url');
}
