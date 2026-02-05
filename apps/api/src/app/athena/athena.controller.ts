import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { AthenaService } from './athena.service';

@Controller('v1/athena')
export class AthenaController {
  constructor(private readonly athenaService: AthenaService) {}

  @Get('organizations/:practiceId')
  getOrganization(
    @Res() response: Response,
    @Param('practiceId') practiceId: string,
  ) {
    const name = this.athenaService.getOrganizationName(practiceId);
    response.json({ name: name ?? null });
  }
}
