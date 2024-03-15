import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { VeradigmService } from './veradigm.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UnifiedTenantEndpoint } from '../tenant/tenant.service';

@Controller('v1/veradigm')
export class VeradigmController {
  constructor(private readonly veradigmService: VeradigmService) {}

  @ApiTags('tenant')
  @ApiOkResponse({
    description: 'The tenants were successfully retrieved',
    type: [UnifiedTenantEndpoint],
  })
  @Get('dstu2/tenants')
  async getData(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.veradigmService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.log(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @ApiTags('tenant')
  @ApiOkResponse({
    description: 'The tenants were successfully retrieved',
    type: [UnifiedTenantEndpoint],
  })
  @Get('tenants')
  async getTenants(@Res() response: Response, @Query('query') query: string) {
    return await this.getData(response, query);
  }
}
