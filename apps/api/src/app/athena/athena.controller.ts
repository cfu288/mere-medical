import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { AthenaService } from './athena.service';

@Controller('v1/athena')
export class AthenaController {
  constructor(private readonly athenaService: AthenaService) {}

  @Get('config')
  getConfig(@Res() response: Response) {
    response.json({
      preview: this.athenaService.getEnvironmentConfig('preview'),
      production: this.athenaService.getEnvironmentConfig('production'),
    });
  }
}
