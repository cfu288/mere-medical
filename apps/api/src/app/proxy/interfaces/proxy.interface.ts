import { ModuleMetadata, Type } from '@nestjs/common/interfaces';
import * as server from 'http-proxy';

export interface Service {
  id: string;
  url: string;
  name: string;
  token: string;
  authorize: string;
  register?: string;
}

export interface ProxyModuleOptions {
  config?: server.ServerOptions;
  allowedCookies?: string[];
}

export interface ProxyModuleOptionsFactory {
  createModuleConfig(): Promise<ProxyModuleOptions> | ProxyModuleOptions;
}

export interface ProxyModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<ProxyModuleOptionsFactory>;
  useClass?: Type<ProxyModuleOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<ProxyModuleOptions> | ProxyModuleOptions;
  inject?: any[];
}
