import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { OnPatientTokenResponse } from '@mere/fhir-oauth';
import { randomUUID } from 'crypto';

export interface OnPatientServiceConfig {
  clientId: string;
  clientSecret: string;
  publicUrl: string;
}

interface CodeCacheEntry {
  code: string;
  expires: number;
}

/**
 * OnPatient OAuth integration service.
 *
 * The vendor redirects the browser to the callback with an authorization code.
 * The service holds that code under a one-time session ID for 60 seconds. The
 * exchange with the client secret happens only when the browser fetches the
 * tokens through the registration-token guarded route. The session ID in the URL is
 * single-use and never a token.
 */
@Injectable()
export class OnPatientService {
  private codeCache = new Map<string, CodeCacheEntry>();

  constructor(
    @Inject('CONFIG') private readonly config: OnPatientServiceConfig,
    private readonly httpService: HttpService,
  ) {}

  storeCode(code: string): string {
    if (!code) {
      throw new HttpException(
        'Forbidden: no auth code provided in callback url',
        HttpStatus.FORBIDDEN,
      );
    }
    const now = Date.now();
    for (const [id, entry] of this.codeCache) {
      if (entry.expires < now) {
        this.codeCache.delete(id);
      }
    }
    const sessionId = randomUUID();
    this.codeCache.set(sessionId, { code, expires: now + 60_000 });
    return sessionId;
  }

  /** Spends the session's code once. Null when the session is unknown, used, or expired. */
  async exchangeSession(
    sessionId: string,
  ): Promise<OnPatientTokenResponse | null> {
    const entry = this.codeCache.get(sessionId);
    this.codeCache.delete(sessionId);
    if (!entry || entry.expires < Date.now()) {
      return null;
    }
    return this.getAuthCode(entry.code);
  }

  async getAuthCode(code: string): Promise<OnPatientTokenResponse> {
    if (!code) {
      throw new HttpException(
        'Forbidden: no auth code provided in callback url',
        HttpStatus.FORBIDDEN,
      );
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: `${this.config.publicUrl}/api/v1/onpatient/callback`,
      code: code,
    });

    const response = await this.httpService.post<OnPatientTokenResponse>(
      'https://onpatient.com/o/token/',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const awaitedRes = await response.toPromise().catch(() => undefined);
    const status = await awaitedRes?.status;

    if (status !== 200) {
      throw new HttpException(
        'Forbidden: unable to get auth token with code',
        HttpStatus.FORBIDDEN,
      );
    }

    const data = await awaitedRes?.data;

    if (!data) {
      throw new HttpException(
        'Forbidden: unable to get auth token with code',
        HttpStatus.FORBIDDEN,
      );
    }

    return data;
  }
}
