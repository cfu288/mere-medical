import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { HTTP_PROXY, PROXY_MODULE_OPTIONS } from '../proxy.constants';
import { VendorServices } from '../interfaces';

const NORTHWELL_R4 = {
  id: '1a5fe784-078b-ef11-91a4-0050568bc890',
  name: 'Northwell Health',
  url: 'https://call.api.northwell.io/epic-proxy/api/fhir/R4/',
  token: 'https://call.api.northwell.io/epic-proxy/oauth2/token',
  authorize: 'https://call.api.northwell.io/epic-proxy/oauth2/authorize',
};

const OCHIN_AACI_R4 = {
  id: '2baa00f4-3236-f011-91f0-0050568bc890',
  name: 'AACI',
  url: 'https://webprd.ochin.org/prd-fhir/MyChartAACI/api/FHIR/R4/',
  token: 'https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/token',
  authorize: 'https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/authorize',
};

const LOMA_LINDA_DSTU2 = {
  id: '989e0f4c-9813-e911-9126-001dd8b71f19',
  name: 'Loma Linda University Health and CareConnect Partners',
  url: 'https://prd.lluh.org/fhir/api/fhir/DSTU2/',
  token: 'https://prd.lluh.org/fhir/oauth2/token',
  authorize: 'https://prd.lluh.org/fhir/oauth2/authorize',
};

const services: VendorServices[] = [
  {
    vendor: 'epic',
    endpoints: [NORTHWELL_R4, OCHIN_AACI_R4, LOMA_LINDA_DSTU2],
  },
];

describe('ProxyService target resolution', () => {
  let service: ProxyService;
  let proxiedTarget: string;

  beforeEach(async () => {
    proxiedTarget = '';
    const mockProxy = {
      web: jest.fn((req: Request) => {
        return req;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyService,
        { provide: HTTP_PROXY, useValue: mockProxy },
        { provide: PROXY_MODULE_OPTIONS, useValue: { services } },
      ],
    }).compile();

    service = module.get<ProxyService>(ProxyService);

    jest
      .spyOn(
        service as unknown as {
          doProxy: (
            req: Request,
            res: Response,
            target: string,
          ) => Promise<void>;
        },
        'doProxy',
      )
      .mockImplementation(async (_req, _res, target) => {
        proxiedTarget = target;
      });
  });

  const proxy = async (serviceId: string, targetType: string) => {
    const req = {
      query: { serviceId, target_type: targetType },
      headers: {},
      method: 'POST',
      url: '/proxy',
      hasOwnProperty: () => false,
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response;

    await service.proxyRequest(req, res);
    return proxiedTarget;
  };

  describe('register target', () => {
    it('resolves the registration url for a tenant with a lowercase fhir path', async () => {
      await expect(proxy(NORTHWELL_R4.id, 'register')).resolves.toBe(
        'https://call.api.northwell.io/epic-proxy/oauth2/register',
      );
    });

    it('keeps a path prefix that sits above the fhir base', async () => {
      await expect(proxy(OCHIN_AACI_R4.id, 'register')).resolves.toBe(
        'https://webprd.ochin.org/prd-fhir/MyChartAACI/oauth2/register',
      );
    });

    it('resolves the registration url for DSTU2 tenants', async () => {
      await expect(proxy(LOMA_LINDA_DSTU2.id, 'register')).resolves.toBe(
        'https://prd.lluh.org/fhir/oauth2/register',
      );
    });
  });

  describe('other targets', () => {
    it('proxies authorize to the tenant authorize url', async () => {
      await expect(proxy(NORTHWELL_R4.id, 'authorize')).resolves.toBe(
        NORTHWELL_R4.authorize,
      );
    });

    it('proxies token to the tenant token url', async () => {
      await expect(proxy(NORTHWELL_R4.id, 'token')).resolves.toBe(
        NORTHWELL_R4.token,
      );
    });

    it('proxies base to the tenant fhir url', async () => {
      await expect(proxy(NORTHWELL_R4.id, 'base')).resolves.toBe(
        NORTHWELL_R4.url,
      );
    });
  });
});
