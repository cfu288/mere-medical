import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CernerService } from './cerner.service';

@Controller('v1/cerner')
export class CernerController {
  constructor(private readonly cernerService: CernerService) {}

  @Get('tenants')
  async getData(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.cernerService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
