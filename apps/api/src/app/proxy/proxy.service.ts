import { Injectable } from '@nestjs/common';
import { EpicDSTU2TenantEndpoints } from './Epic';
import { ProxyModuleOptionsFactory, ProxyModuleOptions } from './interfaces';

@Injectable()
export class ProxyConfigService implements ProxyModuleOptionsFactory {
  constructor() {}

  createModuleConfig(): ProxyModuleOptions {
    const services = EpicDSTU2TenantEndpoints;

    return {
      services,
    };
  }
}
