import {
  Controller,
  Get,
  Inject,
  Logger,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { OnPatientService, OnPatientServiceConfig } from './onpatient.service';
import { RegistrationTokenGuard } from '../proxy/guards';

@Controller('v1/onpatient')
export class OnPatientController {
  constructor(
    private readonly onPatientService: OnPatientService,
    @Inject('CONFIG') private readonly config: OnPatientServiceConfig,
  ) {}

  @Get('callback')
  async callback(@Res() response: Response, @Query('code') code: string) {
    try {
      const sessionId = this.onPatientService.storeCode(code);
      response.redirect(
        `${this.config.publicUrl}/onpatient/callback?session=${sessionId}`,
      );
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @UseGuards(RegistrationTokenGuard)
  @Get('tokens')
  async getTokens(
    @Query('session') sessionId: string,
    @Res() response: Response,
  ) {
    if (!sessionId) {
      return response.status(401).json({ error: 'No session' });
    }

    const tokens = await this.onPatientService.exchangeSession(sessionId);
    if (!tokens) {
      return response
        .status(401)
        .json({ error: 'Session expired or already used' });
    }

    return response.json(tokens);
  }
}
