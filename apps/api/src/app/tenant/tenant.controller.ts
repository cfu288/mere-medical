import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantService } from './tenant.service';

@Controller('v1/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('/')
  async getData(@Res() response: Response, @Query('query') query) {
    try {
      const data = await this.tenantService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.log(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('/test')
  async getData1(@Res() response: Response, @Query('query') query) {
    try {
      const data = await this.tenantService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.log(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
