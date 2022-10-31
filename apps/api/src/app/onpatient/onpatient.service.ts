import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class OnPatientService {
  constructor(private readonly httpService: HttpService) {}
  async getAuthCode(code: string): Promise<OnPatientAuthResponse> {
    if (!code) {
      throw new HttpException(
        'Forbidden: no auth code provided in callback url',
        HttpStatus.FORBIDDEN
      );
    }

    const params = {
      grant_type: 'authorization_code',
      client_id: process.env.ONPATIENT_CLIENT_ID,
      client_secret: process.env.ONPATIENT_CLIENT_SECRET,
      redirect_uri: process.env.ONPATIENT_REDIRECT_URI,
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

interface OnPatientAuthResponse {
  access_token: string;
  expires_in: number;
  patient: string;
  refresh_token: string;
  scope: string;
  token_type: string;
}
