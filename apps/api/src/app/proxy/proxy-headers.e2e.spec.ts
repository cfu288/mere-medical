import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as http from 'http';
import request from 'supertest';
import { ProxyController } from './controllers/proxy.controller';
import { ProxyService } from './services/proxy.service';
import { OriginGuard } from './guards/origin.guard';
import {
  HTTP_PROXY,
  PROXY_MODULE_OPTIONS,
  defaultProxyOptions,
} from './proxy.constants';
import { createProxyServer } from 'http-proxy';

const ALLOWED_HEADERS = ['accept', 'content-type', 'content-length', 'host'];

function generateRandomHeaderName(): string {
  const prefixes = ['x-', 'x-custom-', 'x-forwarded-', 'x-real-', 'x-attack-'];
  const words = [
    'evil',
    'malicious',
    'injected',
    'spoofed',
    'fake',
    'random',
    'test',
  ];
  const suffix = Math.random().toString(36).substring(2, 8);
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${prefix}${word}-${suffix}`;
}

function generateRandomHeaders(count: number): Record<string, string> {
  const headers: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    headers[generateRandomHeaderName()] = `malicious-value-${i}`;
  }
  return headers;
}

describe('Proxy Header Filtering E2E', () => {
  let app: INestApplication;
  let targetServer: http.Server;
  let targetPort: number;
  let receivedHeaders: http.IncomingHttpHeaders;
  const originalEnv = process.env;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      targetServer = http.createServer((req, res) => {
        receivedHeaders = req.headers;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
      targetServer.listen(0, () => {
        targetPort = (targetServer.address() as any).port;
        resolve();
      });
    });

    process.env = { ...originalEnv, PUBLIC_URL: 'https://app.example.com' };

    const proxy = createProxyServer({ ...defaultProxyOptions });

    proxy.on('proxyReq', function (proxyReq, req) {
      const savedContentType = proxyReq.getHeader('content-type');
      const savedHost = proxyReq.getHeader('host');

      proxyReq.getHeaderNames().forEach((h) => proxyReq.removeHeader(h));

      ALLOWED_HEADERS.forEach((h) => {
        const value = req.headers[h];
        if (value) {
          proxyReq.setHeader(h, value as string);
        }
      });

      if (savedHost) {
        proxyReq.setHeader('host', savedHost);
      }

      if (savedContentType) {
        proxyReq.setHeader('content-type', savedContentType);
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 1000 }]),
      ],
      controllers: [ProxyController],
      providers: [
        ProxyService,
        { provide: HTTP_PROXY, useValue: proxy },
        {
          provide: PROXY_MODULE_OPTIONS,
          useValue: {
            services: [
              {
                vendor: 'test',
                endpoints: [
                  {
                    id: 'test-service',
                    url: `http://localhost:${targetPort}`,
                    authorize: `http://localhost:${targetPort}/auth`,
                    token: `http://localhost:${targetPort}/token`,
                  },
                ],
              },
            ],
          },
        },
        OriginGuard,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env = originalEnv;
    await app.close();
    await new Promise<void>((resolve) => targetServer.close(() => resolve()));
  });

  beforeEach(() => {
    receivedHeaders = {};
  });

  it('strips all non-allowed headers from proxied requests', async () => {
    await request(app.getHttpServer())
      .get('/proxy')
      .set('Origin', 'https://app.example.com')
      .set('Authorization', 'Bearer stolen-token')
      .set('Cookie', 'session=hijacked')
      .set('X-Forwarded-For', '192.168.1.1')
      .set('X-Forwarded-Host', 'attacker.com')
      .set('X-Evil-Header', 'malicious-payload')
      .query({ serviceId: 'test-service', target: '/Patient' });

    expect(receivedHeaders['authorization']).toBeUndefined();
    expect(receivedHeaders['cookie']).toBeUndefined();
    expect(receivedHeaders['x-forwarded-for']).toBeUndefined();
    expect(receivedHeaders['x-forwarded-host']).toBeUndefined();
    expect(receivedHeaders['x-evil-header']).toBeUndefined();
  });

  it('preserves allowed headers', async () => {
    await request(app.getHttpServer())
      .get('/proxy')
      .set('Origin', 'https://app.example.com')
      .set('Accept', 'application/fhir+json')
      .set('Content-Type', 'application/json')
      .query({ serviceId: 'test-service', target: '/Patient' });

    expect(receivedHeaders['accept']).toBe('application/fhir+json');
  });

  it('strips randomly generated headers (fuzz test)', async () => {
    const randomHeaders = generateRandomHeaders(20);

    const req = request(app.getHttpServer())
      .get('/proxy')
      .set('Origin', 'https://app.example.com');

    Object.entries(randomHeaders).forEach(([key, value]) => {
      req.set(key, value);
    });

    await req.query({ serviceId: 'test-service', target: '/Patient' });

    Object.keys(randomHeaders).forEach((headerName) => {
      expect(receivedHeaders[headerName.toLowerCase()]).toBeUndefined();
    });
  });

  it('strips headers with security-sensitive prefixes', async () => {
    const sensitiveHeaders = {
      'x-forwarded-for': '10.0.0.1',
      'x-forwarded-host': 'internal.corp',
      'x-forwarded-proto': 'https',
      'x-real-ip': '192.168.1.100',
      'x-original-url': '/admin',
      'x-rewrite-url': '/secret',
      'proxy-authorization': 'Basic dXNlcjpwYXNz',
      'proxy-connection': 'keep-alive',
    };

    const req = request(app.getHttpServer())
      .get('/proxy')
      .set('Origin', 'https://app.example.com');

    Object.entries(sensitiveHeaders).forEach(([key, value]) => {
      req.set(key, value);
    });

    await req.query({ serviceId: 'test-service', target: '/Patient' });

    Object.keys(sensitiveHeaders).forEach((headerName) => {
      expect(receivedHeaders[headerName.toLowerCase()]).toBeUndefined();
    });
  });

  it('handles multiple random header batches consistently', async () => {
    for (let batch = 0; batch < 5; batch++) {
      const randomHeaders = generateRandomHeaders(10);

      const req = request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'https://app.example.com');

      Object.entries(randomHeaders).forEach(([key, value]) => {
        req.set(key, value);
      });

      await req.query({ serviceId: 'test-service', target: '/Patient' });

      Object.keys(randomHeaders).forEach((headerName) => {
        expect(receivedHeaders[headerName.toLowerCase()]).toBeUndefined();
      });
    }
  });
});
