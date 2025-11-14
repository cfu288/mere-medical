import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantService } from './tenant.service';

@Controller('v1')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('dstu2/tenants')
  async getDSTU2Data(
    @Res() response: Response,
    @Query('query') query: string,
    @Query('vendor') vendors: string[],
  ) {
    try {
      const data = await this.tenantService.queryTenants(query, vendors);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('r4/tenants')
  async getR4Data(
    @Res() response: Response,
    @Query('query') query: string,
    @Query('vendor') vendors: string[],
  ) {
    try {
      const data = await this.tenantService.queryR4Tenants(query, vendors);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('tenants')
  async getAllData(
    @Res() response: Response,
    @Query('query') query: string,
    @Query('vendor') vendors: string[],
  ) {
    try {
      const data = await this.tenantService.queryAllTenants(query, vendors);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
