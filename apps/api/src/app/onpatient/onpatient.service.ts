import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { OnPatientTokenResponse } from '@mere/fhir-oauth';
import { randomUUID } from 'crypto';

export interface OnPatientServiceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TokenCacheEntry {
  tokens: OnPatientTokenResponse;
  expires: number;
}

/**
 * OnPatient OAuth integration service.
 *
 * Tokens are temporarily cached server-side and retrieved via a one-time session
 * ID rather than passed directly in URL parameters. While the session ID appears
 * in the URL, it's far less sensitive than actual tokens because it's single-use
 * and expires in 60 seconds. This prevents long-lived token exposure in browser
 * history, server logs, and HTTP referrer headers.
 */
@Injectable()
export class OnPatientService {
  private readonly envConfig: OnPatientServiceConfig;
  private tokenCache = new Map<string, TokenCacheEntry>();

  constructor(
    @Inject('CONFIG') private options: OnPatientServiceConfig,
    private readonly httpService: HttpService,
  ) {
    this.envConfig = options;
  }

  storeTokens(tokens: OnPatientTokenResponse): string {
    const sessionId = randomUUID();
    this.tokenCache.set(sessionId, {
      tokens,
      expires: Date.now() + 60_000,
    });
    return sessionId;
  }

  retrieveTokens(sessionId: string): OnPatientTokenResponse | null {
    const entry = this.tokenCache.get(sessionId);
    if (!entry || entry.expires < Date.now()) {
      this.tokenCache.delete(sessionId);
      return null;
    }
    this.tokenCache.delete(sessionId);
    return entry.tokens;
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
      client_id: this.envConfig.clientId,
      client_secret: this.envConfig.clientSecret,
      redirect_uri: this.envConfig.redirectUri,
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

    const awaitedRes = await response.toPromise();
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
