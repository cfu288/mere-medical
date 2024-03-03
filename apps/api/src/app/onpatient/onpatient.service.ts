import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Inject } from '@nestjs/common';
import { OnPatientAuthResponse } from '@mere/onpatient';

export interface OnPatientServiceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

@Injectable()
export class OnPatientService {
  private readonly envConfig: OnPatientServiceConfig;

  constructor(
    @Inject('CONFIG') private options: OnPatientServiceConfig,
    private readonly httpService: HttpService
  ) {
    this.envConfig = options;
  }

  async getAuthCode(code: string): Promise<OnPatientAuthResponse> {
    if (!code) {
      throw new HttpException(
        'Forbidden: no auth code provided in callback url',
        HttpStatus.FORBIDDEN
      );
    }

    const params = {
      grant_type: 'authorization_code',
      client_id: this.envConfig.clientId,
      client_secret: this.envConfig.clientSecret,
      redirect_uri: this.envConfig.redirectUri,
      code: code,
    };

    const response = await this.httpService.post<OnPatientAuthResponse>(
      'https://onpatient.com/o/token/?' + new URLSearchParams(params),
      null,
      { method: 'POST' }
    );

    const awaitedRes = await response.toPromise();
    const status = await awaitedRes.status;

    if (status !== 200) {
      throw new HttpException(
        'Forbidden: unable to get auth token with code',
        HttpStatus.FORBIDDEN
      );
    }

    const data = await awaitedRes.data;

    return data;
  }
}
