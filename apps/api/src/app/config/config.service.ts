import { Injectable } from '@nestjs/common';

/**
 * Healow supports two OAuth modes depending on environment configuration:
 *
 * PUBLIC CLIENT MODE (HEALOW_CLIENT_ID only):
 *   - Uses PKCE flow for security
 *   - No refresh tokens - users must re-authenticate when access token expires (~1 hour)
 *   - Simpler setup, suitable for testing or when refresh tokens aren't critical
 *
 * CONFIDENTIAL CLIENT MODE (HEALOW_CLIENT_ID + HEALOW_CLIENT_SECRET):
 *   - Server injects client_secret during token exchange
 *   - Enables refresh tokens via offline_access scope
 *   - Better UX - users don't need to re-authenticate frequently
 *   - Requires registering a confidential app with Healow
 *
 * @see https://connect4.healow.com/apps/jsp/dev/r4/fhirClinicalDocumentation.jsp#SymmetricAuthentication
 */
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
  HEALOW_CONFIDENTIAL_MODE?: boolean;
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
      HEALOW_CONFIDENTIAL_MODE: !!process.env.HEALOW_CLIENT_SECRET,
      PUBLIC_URL: process.env.PUBLIC_URL,
    };
  }

  getHealowClientSecret(): string | undefined {
    return process.env.HEALOW_CLIENT_SECRET;
  }
}
