import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantService } from './tenant.service';

@Controller('v1/dstu2/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('/')
  async getData(
    @Res() response: Response,
    @Query('query') query,
    @Query('vendor') vendors
  ) {
    console.log('vendors', vendors);
    try {
      const data = await this.tenantService.queryTenants(query, vendors);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
