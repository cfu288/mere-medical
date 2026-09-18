import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantService } from './tenant.service';

@Controller('v1')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('dstu2/tenants')
  async getDSTU2Tenants(
    @Res() response: Response,
    @Query('query') query: string,
  ) {
    try {
      response.json(await this.tenantService.queryTenants(query));
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('r4/tenants')
  async getR4Tenants(@Res() response: Response, @Query('query') query: string) {
    try {
      response.json(await this.tenantService.queryR4Tenants(query));
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
