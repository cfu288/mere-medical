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
import { ApiTags } from '@nestjs/swagger';

@Controller('v1/epic')
export class EpicController {
  constructor(private readonly epicService: EpicService) {}

  @ApiTags('tenant')
  @Get('dstu2/tenants')
  async getDSTU2Tenants(
    @NestRequest() request: Request,
    @Res() response: Response,
    @Query('query') query: string,
  ) {
    try {
      const data = await this.epicService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }

  @ApiTags('tenant')
  @Get('tenants')
  async getTenants(@Res() response: Response, @Query('query') query: string) {
    try {
      const data = await this.epicService.queryTenants(query);
      response.json(data);
    } catch (e) {
      Logger.error(e);
      response.status(500).send({ message: 'There was an error' });
    }
  }
}
