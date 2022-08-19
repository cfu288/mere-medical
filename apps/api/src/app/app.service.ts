import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}
  async getData(code: string): Promise<OnPatientAuthResponse> {
    if (!code) {
      throw new HttpException(
        'Forbidden: no auth code provided in callback url',
        HttpStatus.FORBIDDEN
      );
    }
    const response = await this.httpService.get(
      'https://onpatient.com/o/token/?' +
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.ONPATIENT_CLIENT_ID,
          client_secret: process.env.ONPATIENT_CLIENT_SECRET,
          redirect_uri: 'https://mari-mu.vercel.app/api/v1/onpatient/callback',
          code: code,
        }),
      {
        method: 'POST',
      }
    );

    const awaitedRes = await firstValueFrom(response);
    const status = await awaitedRes.status;

    if (status !== 200) {
      throw new HttpException(
        'Forbidden: unable to get auth token with code',
        HttpStatus.FORBIDDEN
      );
    }

    const data = (await awaitedRes.data) as OnPatientAuthResponse;

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
