import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { VeradigmService } from './veradigm.service';

@Controller('v1/veradigm')
export class VeradigmController {
  constructor(private readonly veradigmService: VeradigmService) {}

  @Get('tenants')
  async getData(@Res() response: Response, @Query('query') query) {
    try {
      const data = await this.veradigmService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.log(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
