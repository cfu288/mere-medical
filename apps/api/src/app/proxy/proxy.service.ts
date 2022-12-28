import { Injectable, Logger } from '@nestjs/common';
import {
  ProxyModuleOptions,
  ProxyModuleOptionsFactory,
} from '@finastra/nestjs-proxy';
import { EpicDSTU2TenantEndpoints } from './Epic';
// import { EpicDSTU2TenantEndpoints } from '@shared/epic';

@Injectable()
export class ProxyConfigService implements ProxyModuleOptionsFactory {
  constructor() {}

  createModuleConfig(): ProxyModuleOptions {
    const services = EpicDSTU2TenantEndpoints;
    Logger.log(services);

    return {
      services,
    };
  }
}
