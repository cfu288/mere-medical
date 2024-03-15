import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealowService } from './healow.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('v1/healow')
export class HealowController {
  constructor(private readonly HealowService: HealowService) {}

  @ApiTags('tenant')
  @Get('r4/tenants')
  async getData(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.HealowService.queryR4Tenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
