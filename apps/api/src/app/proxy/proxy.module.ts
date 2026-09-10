import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { createProxyServer } from 'http-proxy';
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
import { TenantDbModule } from '../tenant-db/tenant-db.module';
import { concatPath } from './utils';
import { allowedOriginProvider, OriginGuard } from './guards';

const proxyFactory = {
  provide: HTTP_PROXY,
  useFactory: async (options: ProxyModuleOptions) => {
    const logger = new Logger('Proxy');
    const proxy = createProxyServer({
      ...defaultProxyOptions,
      ...options.config,
    });

    const ALLOWED_HEADERS = [
      'accept',
      'authorization',
      'content-type',
      'content-length',
      'host',
    ];

    proxy.on('proxyReq', function (proxyReq, req, _res, opts) {
      const url = concatPath(
        `${proxyReq.protocol}//${proxyReq.host}`,
        req.url ?? '',
      );
      logger.debug(`Sending ${req.method} ${url}`);

      const savedContentType = proxyReq.getHeader('content-type');
      const savedHost = proxyReq.getHeader('host');
      const serverHeaders = opts.headers ?? {};

      proxyReq.getHeaderNames().forEach((h) => proxyReq.removeHeader(h));

      ALLOWED_HEADERS.forEach((h) => {
        const value = req.headers[h];
        if (value) {
          proxyReq.setHeader(h, value);
        }
      });

      if (savedHost) {
        proxyReq.setHeader('host', savedHost);
      }

      Object.entries(serverHeaders).forEach(([key, value]) => {
        if (value) {
          proxyReq.setHeader(key, value as string);
        }
      });

      const allowedCookies = options.allowedCookies || [];
      if (allowedCookies.length > 0) {
        const cookies = ((req.headers.cookie as string) || '')
          .split(';')
          .filter(
            (cookie) =>
              allowedCookies.indexOf(cookie.split('=')[0].trim()) !== -1,
          )
          .join(';');
        if (cookies) {
          proxyReq.setHeader('cookie', cookies);
        }
      }

      const body = (req as typeof req & { body?: Record<string, unknown> })
        .body;
      if (!body || !Object.keys(body).length) {
        return;
      }

      const rawContentType =
        savedContentType || proxyReq.getHeader('content-type');
      const contentType = Array.isArray(rawContentType)
        ? rawContentType[0]
        : rawContentType;
      let bodyData: string | undefined;

      if (contentType === 'application/json') {
        bodyData = JSON.stringify(body);
      }

      if (contentType === 'application/x-www-form-urlencoded') {
        bodyData = queryString.stringify(
          body as Parameters<typeof queryString.stringify>[0],
        );
      }

      if (bodyData) {
        proxyReq.setHeader('content-length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    });

    proxy.on('proxyRes', function (_proxyRes, req) {
      logger.debug(`Received ${req.method} ${req.url ?? ''}`);
    });
    return proxy;
  },
  inject: [PROXY_MODULE_OPTIONS],
};

@Module({
  imports: [
    TenantDbModule,
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 30 },
      { name: 'medium', ttl: 60000, limit: 600 },
    ]),
  ],
  providers: [
    ProxyService,
    proxyFactory,
    OriginGuard,
    allowedOriginProvider,
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
    const useClass = options.useClass;
    if (!useClass) {
      throw new Error(
        'ProxyModule.forRootAsync requires useExisting, useFactory, or useClass',
      );
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: useClass,
        useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(
    options: ProxyModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      const useFactory = options.useFactory;
      return {
        provide: PROXY_MODULE_OPTIONS,
        useFactory: async (...args: unknown[]) => await useFactory(...args),
        inject: options.inject || [],
      };
    }
    const factoryProvider = options.useExisting ?? options.useClass;
    if (!factoryProvider) {
      throw new Error(
        'ProxyModule.forRootAsync requires useExisting, useFactory, or useClass',
      );
    }
    return {
      provide: PROXY_MODULE_OPTIONS,
      useFactory: async (optionsFactory: ProxyModuleOptionsFactory) =>
        await optionsFactory.createModuleConfig(),
      inject: [factoryProvider],
    };
  }
}
export const LoginProxyModule = ProxyModule.forRoot({
  config: {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  },
});
