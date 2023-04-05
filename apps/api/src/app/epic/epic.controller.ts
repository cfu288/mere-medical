import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { EpicService } from './epic.service';

@Controller('v1/epic')
export class EpicController {
  constructor(private readonly epicService: EpicService) {}

  @Get('tenants')
  async getData(@Res() response: Response, @Query('query') query) {
    try {
      const data = await this.epicService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.log(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}