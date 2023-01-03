import { Injectable } from '@nestjs/common';
import { EpicDSTU2TenantEndpoints } from '@mere/epic';
import { ProxyModuleOptionsFactory, ProxyModuleOptions } from './interfaces';

@Injectable()
export class ProxyConfigService implements ProxyModuleOptionsFactory {
  createModuleConfig(): ProxyModuleOptions {
    const services = EpicDSTU2TenantEndpoints;

    return {
      services,
    };
  }
}
