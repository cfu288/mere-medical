import { Injectable } from '@nestjs/common';
import { AthenaOrganizations } from '@mere/athena';

@Injectable()
export class AthenaService {
  private readonly practiceNames = AthenaOrganizations;

  getOrganizationName(practiceId: string): string | undefined {
    return this.practiceNames[practiceId];
  }
}
