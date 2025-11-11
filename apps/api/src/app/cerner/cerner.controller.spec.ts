import { Test, TestingModule } from '@nestjs/testing';
import { CernerController } from './cerner.controller';
import { CernerService } from './cerner.service';
import { Response } from 'express';

describe('CernerController', () => {
  let controller: CernerController;
  let service: CernerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CernerController],
      providers: [CernerService],
    }).compile();

    controller = module.get<CernerController>(CernerController);
    service = module.get<CernerService>(CernerService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /tenants (DSTU2)', () => {
    it('should return tenant data via response.json()', async () => {
      const mockData = [
        {
          id: 'test-id',
          name: 'Test Tenant',
          url: 'https://example.com',
          token: 'https://example.com/token',
          authorize: 'https://example.com/authorize',
        },
      ];

      jest.spyOn(service, 'queryTenants').mockResolvedValue(mockData);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getData(mockResponse, 'test');

      expect(service.queryTenants).toHaveBeenCalledWith('test');
      expect(mockResponse.json).toHaveBeenCalledWith(mockData);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should pass query parameter to service', async () => {
      jest.spyOn(service, 'queryTenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getData(mockResponse, 'sandbox');

      expect(service.queryTenants).toHaveBeenCalledWith('sandbox');
    });

    it('should handle empty query string', async () => {
      jest.spyOn(service, 'queryTenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getData(mockResponse, '');

      expect(service.queryTenants).toHaveBeenCalledWith('');
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      const error = new Error('Service error');
      jest.spyOn(service, 'queryTenants').mockRejectedValue(error);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getData(mockResponse, 'test');

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
        },
      ];

      jest.spyOn(service, 'queryR4Tenants').mockResolvedValue(mockData);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse, 'test');

      expect(service.queryR4Tenants).toHaveBeenCalledWith('test');
      expect(mockResponse.json).toHaveBeenCalledWith(mockData);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should pass query parameter to R4 service method', async () => {
      jest.spyOn(service, 'queryR4Tenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse, 'sandbox');

      expect(service.queryR4Tenants).toHaveBeenCalledWith('sandbox');
    });

    it('should handle empty query string', async () => {
      jest.spyOn(service, 'queryR4Tenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse, '');

      expect(service.queryR4Tenants).toHaveBeenCalledWith('');
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      const error = new Error('R4 Service error');
      jest.spyOn(service, 'queryR4Tenants').mockRejectedValue(error);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getR4Data(mockResponse, 'test');

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle undefined query parameter', async () => {
      jest.spyOn(service, 'queryTenants').mockResolvedValue([]);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getData(mockResponse, undefined as any);

      expect(service.queryTenants).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should not expose internal error details', async () => {
      const error = new Error('Internal database connection failed');
      jest.spyOn(service, 'queryTenants').mockRejectedValue(error);

      const mockResponse = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.getData(mockResponse, 'test');

      expect(mockResponse.send).toHaveBeenCalledWith({
        message: 'There was an error',
      });

      const sentMessage = (mockResponse.send as jest.Mock).mock.calls[0][0];
      expect(sentMessage.message).not.toContain('database');
      expect(sentMessage.message).not.toContain('Internal');
    });
  });
});
