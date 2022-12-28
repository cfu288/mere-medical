import {
  All,
  Controller,
  Logger,
  Param,
  Request as NestRequest,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from '../services';

@Controller('?*/proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(private proxyService: ProxyService) {}

  @All('')
  async proxy(
    @Res() response: Response,
    @NestRequest() request: Request,
    @Param() params
  ) {
    try {
      this.proxyService.proxyRequest(request, response, params);
    } catch (err) {
      const msg = 'An error occurred while making the proxy call';

      response.status(500).send({ error: msg });

      this.logger.error(msg, err);
    }
  }
}
