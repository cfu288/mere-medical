import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantService, UnifiedTenantEndpoint } from './tenant.service';
import { ApiBody, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

type DSTU2Vendor = 'veradigm' | 'epic' | 'cerner';

@ApiTags('tenant')
@Controller('v1')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @ApiQuery({
    name: 'vendor',
    required: true,
    schema: {
      type: 'string',
      enum: ['veradigm', 'epic', 'cerner'],
    },
    description: 'Which DSTU2 EMR vendor to query for tenants',
  })
  @ApiOkResponse({
    description: 'The tenants were successfully retrieved',
    type: [UnifiedTenantEndpoint],
  })
  @Get('dstu2/tenants')
  async getDataDSTU2(
    @Res() response: Response,
    @Query('query') query: string,
    @Query('vendor') vendors: DSTU2Vendor[],
  ) {
    try {
      const data = await this.tenantService.queryDSTU2Tenants(query, vendors);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @ApiQuery({
    name: 'vendor',
    required: true,
    schema: {
      type: 'string',
      enum: ['healow'],
    },
    description: 'Which R4 EMR vendor to query for tenants',
  })
  @ApiOkResponse({
    description: 'The tenants were successfully retrieved',
    type: [UnifiedTenantEndpoint],
  })
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

  @ApiQuery({
    name: 'vendor',
    required: true,
    schema: {
      type: 'string',
      enum: ['healow', 'veradigm', 'epic', 'cerner'],
    },
    description: 'Which EMR vendor to query for tenants',
  })
  @ApiOkResponse({
    description: 'The tenants were successfully retrieved',
    type: [UnifiedTenantEndpoint],
  })
  @Get('tenants')
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
