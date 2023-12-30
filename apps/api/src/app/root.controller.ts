import {
  Controller,
  Get,
  Logger,
  Request as NestRequest,
} from '@nestjs/common';

@Controller('health')
export class RootController {
  @Get('/')
  getData(@NestRequest() request: Request) {
    Logger.log({
      message: `Health check request was made `,
      route: request.url,
      timestamp: new Date().toISOString(),
    });
    return '🚀';
  }
}
