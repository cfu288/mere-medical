import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantService } from './tenant.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('tenant')
@Controller('v1')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('dstu2/tenants')
  async getDataDSTU2(
    @Res() response: Response,
    @Query('query') query: string,
    @Query('vendor') vendors: string[],
  ) {
    try {
      const data = await this.tenantService.queryDSTU2Tenants(query, vendors);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('r4/tenants')
  async getDataR4(
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

  @Get('tenants') // mixed
  async getData(
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
}
