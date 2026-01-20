import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { buildVARedirectUrl } from './va.utils';

@Controller('v1/va')
export class VAController {
  @Get('app-redirect')
  async redirectToApp(
    @Res() response: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    try {
      const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:4200';
      const redirectUrl = buildVARedirectUrl(webAppUrl, code, state);
      response.redirect(302, redirectUrl);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
