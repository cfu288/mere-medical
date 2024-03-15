import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CernerService } from './cerner.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('v1/cerner')
export class CernerController {
  constructor(private readonly cernerService: CernerService) {}

  @ApiTags('tenant')
  @Get('dstu2/tenants')
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
