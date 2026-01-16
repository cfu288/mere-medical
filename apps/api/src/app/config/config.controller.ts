import { Controller, Get } from '@nestjs/common';
import { ConfigService, PublicConfig } from './config.service';

@Controller('v1/instance-config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getConfig(): PublicConfig {
    return this.configService.getPublicConfig();
  }
}
