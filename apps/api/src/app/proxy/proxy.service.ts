import { Injectable } from '@nestjs/common';
import {
  ProxyModuleOptions,
  ProxyModuleOptionsFactory,
} from '@finastra/nestjs-proxy';
import { EpicDSTU2TenantEndpoints } from './Epic';

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
