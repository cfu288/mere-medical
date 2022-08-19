import { Test } from '@nestjs/testing';

import { OnPatientService } from './onpatient.service';

describe('OnPatientService', () => {
  let service: OnPatientService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [OnPatientService],
    }).compile();

    service = app.get<OnPatientService>(OnPatientService);
  });

  describe('getData', () => {
    it('should return "Welcome to api!"', () => {
      expect(service.getAuthCode('test')).toEqual({
        message: 'Welcome to api!',
      });
    });
  });
});
