import { Test, TestingModule } from '@nestjs/testing';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { Response } from 'express';

describe('TenantController', () => {
  let controller: TenantController;
  let service: TenantService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [TenantService],
    }).compile();

    controller = module.get<TenantController>(TenantController);
    service = module.get<TenantService>(TenantService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /dstu2/tenants', () => {
    it('should return DSTU2 tenant data via response.json()', async () => {
      const mockData = [
        {
          id: 'test-id',
          name: 'Test Tenant',
          url: 'https://example.com',
          token: 'https://example.com/token',
          authorize: 'https://example.com/authorize',
          vendor: 'CERNER' as const,
          version: 'DSTU2' as const,
        },
      ];

      jest.spyOn(service, 'queryTenants').mockResolvedValue(mockData);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getDSTU2Data(mockResponse, 'test', []);

      expect(service.queryTenants).toHaveBeenCalledWith('test', []);
      expect(mockResponse.json).toHaveBeenCalledWith(mockData);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should pass query and vendor parameters to service', async () => {
      jest.spyOn(service, 'queryTenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getDSTU2Data(mockResponse, 'sandbox', ['CERNER']);

      expect(service.queryTenants).toHaveBeenCalledWith('sandbox', ['CERNER']);
    });

    it('should handle multiple vendor parameters', async () => {
      jest.spyOn(service, 'queryTenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getDSTU2Data(mockResponse, '', ['CERNER', 'EPIC']);

      expect(service.queryTenants).toHaveBeenCalledWith('', ['CERNER', 'EPIC']);
    });

    it('should return 500 on service error', async () => {
      const error = new Error('DSTU2 Service error');
      jest.spyOn(service, 'queryTenants').mockRejectedValue(error);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getDSTU2Data(mockResponse, 'test', []);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('GET /r4/tenants', () => {
    it('should return R4 tenant data via response.json()', async () => {
      const mockData = [
        {
          id: 'test-r4-id',
          name: 'Test R4 Tenant',
          url: 'https://example.com/r4/',
          token: 'https://example.com/token',
          authorize: 'https://example.com/authorize',
          vendor: 'CERNER' as const,
          version: 'R4' as const,
        },
      ];

      jest.spyOn(service, 'queryR4Tenants').mockResolvedValue(mockData);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse, 'test', []);

      expect(service.queryR4Tenants).toHaveBeenCalledWith('test', []);
      expect(mockResponse.json).toHaveBeenCalledWith(mockData);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should pass query and vendor parameters to R4 service', async () => {
      jest.spyOn(service, 'queryR4Tenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse, 'clinic', ['CERNER']);

      expect(service.queryR4Tenants).toHaveBeenCalledWith('clinic', ['CERNER']);
    });

    it('should return 500 on service error', async () => {
      const error = new Error('R4 Service error');
      jest.spyOn(service, 'queryR4Tenants').mockRejectedValue(error);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse, 'test', []);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('GET /tenants (unified)', () => {
    it('should return unified tenant data via response.json()', async () => {
      const mockData = [
        {
          id: 'dstu2-id',
          name: 'DSTU2 Tenant',
          url: 'https://example.com/dstu2/',
          token: 'https://example.com/token',
          authorize: 'https://example.com/authorize',
          vendor: 'CERNER' as const,
          version: 'DSTU2' as const,
        },
        {
          id: 'r4-id',
          name: 'R4 Tenant',
          url: 'https://example.com/r4/',
          token: 'https://example.com/token',
          authorize: 'https://example.com/authorize',
          vendor: 'CERNER' as const,
          version: 'R4' as const,
        },
      ];

      jest.spyOn(service, 'queryAllTenants').mockResolvedValue(mockData);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getAllData(mockResponse, 'test', []);

      expect(service.queryAllTenants).toHaveBeenCalledWith('test', []);
      expect(mockResponse.json).toHaveBeenCalledWith(mockData);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should pass query and vendor parameters to unified service', async () => {
      jest.spyOn(service, 'queryAllTenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getAllData(mockResponse, 'sandbox', ['CERNER', 'EPIC']);

      expect(service.queryAllTenants).toHaveBeenCalledWith('sandbox', [
        'CERNER',
        'EPIC',
      ]);
    });

    it('should return 500 on service error', async () => {
      const error = new Error('Unified Service error');
      jest.spyOn(service, 'queryAllTenants').mockRejectedValue(error);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getAllData(mockResponse, 'test', []);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('error handling consistency', () => {
    it('should use same error format across all endpoints', async () => {
      const error = new Error('Test error');
      jest.spyOn(service, 'queryTenants').mockRejectedValue(error);
      jest.spyOn(service, 'queryR4Tenants').mockRejectedValue(error);
      jest.spyOn(service, 'queryAllTenants').mockRejectedValue(error);

      const mockResponse1 = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getDSTU2Data(mockResponse1, 'test', []);
      expect(mockResponse1.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });

      const mockResponse2 = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse2, 'test', []);
      expect(mockResponse2.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });

      const mockResponse3 = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getAllData(mockResponse3, 'test', []);
      expect(mockResponse3.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });
    });
  });
});
