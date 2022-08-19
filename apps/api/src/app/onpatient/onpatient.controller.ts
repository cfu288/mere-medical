import { Controller, Get, Query, Res } from '@nestjs/common';
import { environment } from '../../environments/environment';
import { Response } from 'express';
import { OnPatientService } from './onpatient.service';

@Controller('v1/onpatient')
export class OnPatientController {
  constructor(private readonly onPatientService: OnPatientService) {}

  @Get('callback')
  async getData(@Res() response: Response, @Query('code') code) {
    const data = await this.onPatientService.getAuthCode(code);
    response.redirect(
      `${environment.frontend_app_redirect}?accessToken=${data.access_token}&refreshToken=${data.refresh_token}&expiresIn=${data.expires_in}`
    );
  }
}
