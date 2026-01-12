import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealowService } from './healow.service';

@Controller('v1/healow')
export class HealowController {
  constructor(private readonly healowService: HealowService) {}

  @Get('tenants')
  async getTenants(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.healowService.queryR4Tenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('r4/tenants')
  async getR4Tenants(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.healowService.queryR4Tenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
