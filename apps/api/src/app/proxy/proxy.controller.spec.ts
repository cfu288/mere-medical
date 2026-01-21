import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { ProxyController } from './controllers/proxy.controller';
import { ProxyService } from './services/proxy.service';
import { OriginGuard } from './guards/origin.guard';
import { HTTP_PROXY, PROXY_MODULE_OPTIONS } from './proxy.constants';

describe('ProxyController Origin Validation', () => {
  let app: INestApplication;
  const originalEnv = process.env;

  const mockProxyService = {
    proxyRequest: jest.fn(),
  };

  const mockProxy = {};

  beforeAll(async () => {
    process.env = { ...originalEnv, PUBLIC_URL: 'https://app.example.com' };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 1000 }]),
      ],
      controllers: [ProxyController],
      providers: [
        { provide: ProxyService, useValue: mockProxyService },
        { provide: HTTP_PROXY, useValue: mockProxy },
        { provide: PROXY_MODULE_OPTIONS, useValue: { services: [] } },
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid origin requests', () => {
    it('accepts requests with valid Origin', async () => {
      mockProxyService.proxyRequest.mockImplementation((_req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'https://app.example.com')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).not.toBe(403);
    });

    it('accepts requests with valid Referer (no Origin)', async () => {
      mockProxyService.proxyRequest.mockImplementation((_req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Referer', 'https://app.example.com/connections')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).not.toBe(403);
    });

    it('accepts Origin with path component', async () => {
      mockProxyService.proxyRequest.mockImplementation((_req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'https://app.example.com/some/path')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).not.toBe(403);
    });
  });

  describe('Invalid origin requests', () => {
    it('rejects requests with no Origin header', async () => {
      const response = await request(app.getHttpServer())
        .get('/proxy')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).toBe(403);
    });

    it('rejects requests with invalid Origin', async () => {
      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'https://malicious-site.com')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).toBe(403);
    });

    it('rejects requests with Origin from different port', async () => {
      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'https://app.example.com:8080')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).toBe(403);
    });

    it('rejects requests with Origin from different protocol', async () => {
      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'http://app.example.com')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).toBe(403);
    });

    it('rejects requests with malformed Origin URL', async () => {
      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'not-a-valid-url')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).toBe(403);
    });
  });
});

describe('ProxyController Origin Validation - Missing PUBLIC_URL', () => {
  let app: INestApplication;
  const originalEnv = process.env;

  const mockProxyService = {
    proxyRequest: jest.fn(),
  };

  const mockProxy = {};

  beforeAll(async () => {
    const envWithoutPublicUrl = { ...originalEnv };
    envWithoutPublicUrl.PUBLIC_URL = '';
    process.env = envWithoutPublicUrl;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'short', ttl: 1000, limit: 1000 }]),
      ],
      controllers: [ProxyController],
      providers: [
        { provide: ProxyService, useValue: mockProxyService },
        { provide: HTTP_PROXY, useValue: mockProxy },
        { provide: PROXY_MODULE_OPTIONS, useValue: { services: [] } },
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
  });

  it('rejects all requests when PUBLIC_URL is not set', async () => {
    const response = await request(app.getHttpServer())
      .get('/proxy')
      .set('Origin', 'https://any-origin.com')
      .query({ serviceId: 'test', target: '/Patient' });

    expect(response.status).toBe(403);
  });
});

describe('ProxyController Rate Limiting', () => {
  let app: INestApplication;
  const originalEnv = process.env;

  const mockProxyService = {
    proxyRequest: jest.fn(),
  };

  const mockProxy = {};

  beforeAll(async () => {
    process.env = { ...originalEnv, PUBLIC_URL: 'https://app.example.com' };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 1000, limit: 5 },
          { name: 'medium', ttl: 60000, limit: 10 },
        ]),
      ],
      controllers: [ProxyController],
      providers: [
        { provide: ProxyService, useValue: mockProxyService },
        { provide: HTTP_PROXY, useValue: mockProxy },
        { provide: PROXY_MODULE_OPTIONS, useValue: { services: [] } },
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows requests within limit then returns 429 when exceeded', async () => {
    mockProxyService.proxyRequest.mockImplementation((_req, res) => {
      res.status(200).json({ success: true });
    });

    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'https://app.example.com')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).not.toBe(429);
    }

    const exceededResponse = await request(app.getHttpServer())
      .get('/proxy')
      .set('Origin', 'https://app.example.com')
      .query({ serviceId: 'test', target: '/Patient' });

    expect(exceededResponse.status).toBe(429);
  });
});

describe('ProxyController Rate Limiting - Medium Window', () => {
  let app: INestApplication;
  const originalEnv = process.env;

  const mockProxyService = {
    proxyRequest: jest.fn(),
  };

  const mockProxy = {};

  beforeAll(async () => {
    process.env = { ...originalEnv, PUBLIC_URL: 'https://app.example.com' };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 1000, limit: 1000 },
          { name: 'medium', ttl: 60000, limit: 5 },
        ]),
      ],
      controllers: [ProxyController],
      providers: [
        { provide: ProxyService, useValue: mockProxyService },
        { provide: HTTP_PROXY, useValue: mockProxy },
        { provide: PROXY_MODULE_OPTIONS, useValue: { services: [] } },
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows requests within limit then returns 429 when exceeded', async () => {
    mockProxyService.proxyRequest.mockImplementation((_req, res) => {
      res.status(200).json({ success: true });
    });

    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer())
        .get('/proxy')
        .set('Origin', 'https://app.example.com')
        .query({ serviceId: 'test', target: '/Patient' });

      expect(response.status).not.toBe(429);
    }

    const exceededResponse = await request(app.getHttpServer())
      .get('/proxy')
      .set('Origin', 'https://app.example.com')
      .query({ serviceId: 'test', target: '/Patient' });

    expect(exceededResponse.status).toBe(429);
  });
});

describe('ProxyService Header Filtering', () => {
  const ALLOWED_PROXY_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'content-length',
    'host',
  ];

  it('filters out non-allowed headers', () => {
    const inputHeaders = {
      accept: 'application/json',
      'content-type': 'application/fhir+json',
      'content-length': '100',
      'x-evil-header': 'malicious-payload',
      authorization: 'Bearer token',
      cookie: 'session=abc123',
      host: 'fhir.example.com',
    };

    const filteredHeaders = Object.fromEntries(
      Object.entries(inputHeaders).filter(([key]) =>
        ALLOWED_PROXY_HEADERS.includes(key.toLowerCase()),
      ),
    );

    expect(filteredHeaders).toEqual({
      accept: 'application/json',
      authorization: 'Bearer token',
      'content-type': 'application/fhir+json',
      'content-length': '100',
      host: 'fhir.example.com',
    });
    expect(filteredHeaders['x-evil-header']).toBeUndefined();
    expect(filteredHeaders['cookie']).toBeUndefined();
  });

  it('preserves allowed headers with different cases', () => {
    const inputHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/fhir+json',
      'CONTENT-LENGTH': '100',
    };

    const filteredHeaders = Object.fromEntries(
      Object.entries(inputHeaders).filter(([key]) =>
        ALLOWED_PROXY_HEADERS.includes(key.toLowerCase()),
      ),
    );

    expect(Object.keys(filteredHeaders).length).toBe(3);
  });

  it('handles empty headers', () => {
    const inputHeaders = {};

    const filteredHeaders = Object.fromEntries(
      Object.entries(inputHeaders).filter(([key]) =>
        ALLOWED_PROXY_HEADERS.includes(key.toLowerCase()),
      ),
    );

    expect(filteredHeaders).toEqual({});
  });

  it('filters X-Forwarded-* headers', () => {
    const inputHeaders = {
      accept: 'application/json',
      'x-forwarded-for': '192.168.1.1',
      'x-forwarded-host': 'attacker.com',
      'x-forwarded-proto': 'http',
    };

    const filteredHeaders = Object.fromEntries(
      Object.entries(inputHeaders).filter(([key]) =>
        ALLOWED_PROXY_HEADERS.includes(key.toLowerCase()),
      ),
    );

    expect(filteredHeaders).toEqual({ accept: 'application/json' });
    expect(filteredHeaders['x-forwarded-for']).toBeUndefined();
    expect(filteredHeaders['x-forwarded-host']).toBeUndefined();
    expect(filteredHeaders['x-forwarded-proto']).toBeUndefined();
  });
});
