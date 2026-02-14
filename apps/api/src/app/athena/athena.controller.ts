import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import { AthenaService } from './athena.service';
import { OriginGuard } from '../proxy/guards/origin.guard';

@Controller('v1/athena')
@UseGuards(OriginGuard, ThrottlerGuard)
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
