import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { OnPatientService } from './onpatient.service';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('v1/onpatient')
export class OnPatientController {
  constructor(private readonly onPatientService: OnPatientService) {}

  @ApiTags('app-redirect')
  @ApiResponse({
    status: 302,
    description: 'Redirects from the OnPatient authorization page to the app',
  })
  @Get('callback')
  async getData(@Res() response: Response, @Query('code') code: string) {
    try {
      const data = await this.onPatientService.getAuthCode(code);
      response.redirect(
        `${process.env.PUBLIC_URL}/onpatient/callback?accessToken=${data.access_token}&refreshToken=${data.refresh_token}&expiresIn=${data.expires_in}`,
      );
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
