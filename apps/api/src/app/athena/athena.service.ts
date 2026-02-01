import { Injectable } from '@nestjs/common';

export interface AthenaEnvironmentConfig {
  authUrl: string;
  tokenUrl: string;
  fhirBaseUrl: string;
}

@Injectable()
export class AthenaService {
  getEnvironmentConfig(
    environment: 'preview' | 'production',
  ): AthenaEnvironmentConfig {
    if (environment === 'preview') {
      return {
        authUrl:
          'https://api.preview.platform.athenahealth.com/oauth2/v1/authorize',
        tokenUrl:
          'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
        fhirBaseUrl: 'https://api.preview.platform.athenahealth.com/fhir/r4',
      };
    }
    return {
      authUrl: 'https://api.platform.athenahealth.com/oauth2/v1/authorize',
      tokenUrl: 'https://api.platform.athenahealth.com/oauth2/v1/token',
      fhirBaseUrl: 'https://api.platform.athenahealth.com/fhir/r4',
    };
  }
}
