import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { VeradigmService } from './veradigm.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('v1/veradigm')
export class VeradigmController {
  constructor(private readonly veradigmService: VeradigmService) {}

  @ApiTags('tenant')
  @Get('tenants')
  async getData(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.veradigmService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.log(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
