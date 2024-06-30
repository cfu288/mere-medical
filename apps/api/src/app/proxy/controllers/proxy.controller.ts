import {
  All,
  Controller,
  Logger,
  Param,
  Request as NestRequest,
  Res,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from '../services';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('proxy')
@Controller('?*/proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(private proxyService: ProxyService) {}

  @All('')
  @ApiQuery({
    name: 'target',
    required: true,
    type: String,
    description: 'The target relative URL to proxy to',
  })
  @ApiQuery({
    name: 'target_type',
    required: true,
    schema: {
      type: 'string',
      enum: ['token', 'base', 'register'],
    },
    description: 'The type of the target URL',
  })
  @ApiQuery({
    name: 'serviceId',
    required: true,
    type: String,
    description: 'The serviceId of the EPIC instance to proxy to',
  })
  async proxy(
    @Res() response: Response,
    @NestRequest()
    request: Request<
      unknown,
      unknown,
      unknown,
      { target: string; target_type: string; serviceId: string },
      Record<string, any>
    >,
    @Param() params: Record<string, string>,
  ) {
    try {
      Logger.debug(
        `Proxy request was made with params: ${JSON.stringify(params)}`,
      );
      this.proxyService.proxyRequest(request, response, params);
    } catch (err) {
      const msg = 'An error occurred while making the proxy call';
      response.status(500).send({ error: msg });
      Logger.error(err);
    }
  }
}
