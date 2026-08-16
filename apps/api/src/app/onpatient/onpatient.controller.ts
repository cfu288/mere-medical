import { Controller, Get, Inject, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { OnPatientService, OnPatientServiceConfig } from './onpatient.service';

@Controller('v1/onpatient')
export class OnPatientController {
  constructor(
    private readonly onPatientService: OnPatientService,
    @Inject('CONFIG') private readonly config: OnPatientServiceConfig,
  ) {}

  @Get('callback')
  async callback(@Res() response: Response, @Query('code') code: string) {
    try {
      const tokens = await this.onPatientService.getAuthCode(code);
      const sessionId = this.onPatientService.storeTokens(tokens);
      response.redirect(
        `${this.config.publicUrl}/onpatient/callback?session=${sessionId}`,
      );
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('tokens')
  async getTokens(
    @Query('session') sessionId: string,
    @Res() response: Response,
  ) {
    if (!sessionId) {
      return response.status(401).json({ error: 'No session' });
    }

    const tokens = this.onPatientService.retrieveTokens(sessionId);
    if (!tokens) {
      return response
        .status(401)
        .json({ error: 'Session expired or already used' });
    }

    return response.json(tokens);
  }
}
