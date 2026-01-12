import { Injectable } from '@nestjs/common';

export interface PublicConfig {
  ONPATIENT_CLIENT_ID?: string;
  EPIC_CLIENT_ID?: string;
  EPIC_CLIENT_ID_DSTU2?: string;
  EPIC_CLIENT_ID_R4?: string;
  EPIC_SANDBOX_CLIENT_ID?: string;
  EPIC_SANDBOX_CLIENT_ID_DSTU2?: string;
  EPIC_SANDBOX_CLIENT_ID_R4?: string;
  CERNER_CLIENT_ID?: string;
  VERADIGM_CLIENT_ID?: string;
  VA_CLIENT_ID?: string;
  HEALOW_CLIENT_ID?: string;
  PUBLIC_URL?: string;
}

@Injectable()
export class ConfigService {
  getPublicConfig(): PublicConfig {
    return {
      ONPATIENT_CLIENT_ID: process.env.ONPATIENT_CLIENT_ID,
      EPIC_CLIENT_ID: process.env.EPIC_CLIENT_ID,
      EPIC_CLIENT_ID_DSTU2: process.env.EPIC_CLIENT_ID_DSTU2,
      EPIC_CLIENT_ID_R4: process.env.EPIC_CLIENT_ID_R4,
      EPIC_SANDBOX_CLIENT_ID: process.env.EPIC_SANDBOX_CLIENT_ID,
      EPIC_SANDBOX_CLIENT_ID_DSTU2: process.env.EPIC_SANDBOX_CLIENT_ID_DSTU2,
      EPIC_SANDBOX_CLIENT_ID_R4: process.env.EPIC_SANDBOX_CLIENT_ID_R4,
      CERNER_CLIENT_ID: process.env.CERNER_CLIENT_ID,
      VERADIGM_CLIENT_ID: process.env.VERADIGM_CLIENT_ID,
      VA_CLIENT_ID: process.env.VA_CLIENT_ID,
      HEALOW_CLIENT_ID: process.env.HEALOW_CLIENT_ID,
      PUBLIC_URL: process.env.PUBLIC_URL,
    };
  }
}
