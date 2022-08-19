import { Controller, Get, HttpService, Query, Req } from '@nestjs/common';

import { AppService } from './app.service';

@Controller('v1/onpatient')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('callback')
  async getData(@Query('code') code) {
    const res = await this.appService.getData(code);
  }
}
