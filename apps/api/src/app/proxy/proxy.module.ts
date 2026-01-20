// @ts-nocheck
import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { createProxyServer } from 'http-proxy';
import { EpicDSTU2TenantEndpoints, EpicR4TenantEndpoints } from '@mere/epic';
import { HealowR4TenantEndpoints } from '@mere/healow';
import * as queryString from 'querystring';
import { ProxyController } from './controllers';
import {
  ProxyModuleAsyncOptions,
  ProxyModuleOptions,
  ProxyModuleOptionsFactory,
} from './interfaces';
import {
  defaultProxyOptions,
  HTTP_PROXY,
  PROXY_MODULE_OPTIONS,
} from './proxy.constants';
import { ProxyService } from './services';
import { concatPath } from './utils';
import { OriginGuard } from './guards';

const proxyFactory = {
  provide: HTTP_PROXY,
  useFactory: async (options: ProxyModuleOptions) => {
    const logger = new Logger('Proxy');
    const proxy = createProxyServer({
      ...defaultProxyOptions,
      ...options.config,
    });

    proxy.on('proxyReq', function (proxyReq, req, res, opts) {
      const url = concatPath(`${proxyReq.protocol}//${proxyReq.host}`, req.url);
      logger.debug(`Sending ${req.method} ${url}`);

      let cookies = (proxyReq.getHeader('cookie') || '') as string;
      const allowedCookies = options.allowedCookies || [];
      cookies = cookies
        .split(';')
        .filter(
          (cookie) =>
            allowedCookies.indexOf(cookie.split('=')[0].trim()) !== -1,
        )
        .join(';');

      proxyReq.setHeader('cookie', cookies);

      if (!req['body'] || !Object.keys(req['body']).length) {
        return;
      }

      const contentType = proxyReq.getHeader('Content-Type');
      let bodyData: string;

      if (contentType === 'application/json') {
        bodyData = JSON.stringify(req['body']);
      }

      if (contentType === 'application/x-www-form-urlencoded') {
        bodyData = queryString.stringify(req['body']);
      }

      if (bodyData) {
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    });

    proxy.on('proxyRes', function (proxyRes, req, res) {
      const url = concatPath(
        `${proxyRes['req'].protocol}//${proxyRes['req'].host}`,
        req.url,
      );
      logger.debug(`Received ${req.method} ${url}`);
    });
    return proxy;
  },
  inject: [PROXY_MODULE_OPTIONS],
};

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 30 },
      { name: 'medium', ttl: 60000, limit: 600 },
    ]),
  ],
  providers: [
    ProxyService,
    proxyFactory,
    OriginGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  controllers: [ProxyController],
})
export class ProxyModule {
  static forRoot(options: ProxyModuleOptions): DynamicModule {
    return {
      module: ProxyModule,
      providers: [
        {
          provide: PROXY_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    };
  }

  static forRootAsync(options: ProxyModuleAsyncOptions): DynamicModule {
    return {
      module: ProxyModule,
      imports: options.imports,
      providers: [...this.createAsyncProviders(options)],
    };
  }

  private static createAsyncProviders(
    options: ProxyModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: ProxyModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: PROXY_MODULE_OPTIONS,
        useFactory: async (...args: any[]) => await options.useFactory(...args),
        inject: options.inject || [],
      };
    }
    return {
      provide: PROXY_MODULE_OPTIONS,
      useFactory: async (optionsFactory: ProxyModuleOptionsFactory) =>
        await optionsFactory.createModuleConfig(),
      inject: [options.useExisting || options.useClass],
    };
  }
}
export const LoginProxyModule = ProxyModule.forRoot({
  config: {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  },
  services: [
    {
      vendor: 'epic',
      endpoints: [...EpicDSTU2TenantEndpoints, ...EpicR4TenantEndpoints],
    },
    { vendor: 'healow', endpoints: [...HealowR4TenantEndpoints] },
  ],
});
