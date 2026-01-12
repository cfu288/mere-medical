import { Injectable } from '@nestjs/common';
import { EpicDSTU2TenantEndpoints, EpicR4TenantEndpoints } from '@mere/epic';
import { HealowR4TenantEndpoints } from '@mere/healow';
import { ProxyModuleOptionsFactory, ProxyModuleOptions } from './interfaces';

@Injectable()
export class ProxyConfigService implements ProxyModuleOptionsFactory {
  createModuleConfig(): ProxyModuleOptions {
    return {
      services: [
        {
          vendor: 'epic',
          endpoints: [...EpicDSTU2TenantEndpoints, ...EpicR4TenantEndpoints],
        },
        { vendor: 'healow', endpoints: [...HealowR4TenantEndpoints] },
      ],
    };
  }
}
