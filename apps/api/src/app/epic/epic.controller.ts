import {
  Controller,
  Get,
  Logger,
  Query,
  Res,
  Request as NestRequest,
} from '@nestjs/common';
import { Response } from 'express';
import { EpicService } from './epic.service';

@Controller('v1/epic')
export class EpicController {
  constructor(private readonly epicService: EpicService) {}

  @Get('dstu2/tenants')
  async getDSTU2Tenants(
    @NestRequest() request: Request,
    @Res() response: Response,
    @Query('query') query
  ) {
    try {
      Logger.log({
        message: `Query for DSTU2 tenants: ${query}`,
        route: request.url,
        timestamp: new Date().toISOString(),
      });
      const data = await this.epicService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.error({
        error: e,
        route: request.url,
        timestamp: new Date().toISOString(),
      });
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @Get('tenants')
  async getTenants(@Res() response: Response, @Query('query') query) {
    try {
      const data = await this.epicService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.log(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
