declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      ONPATIENT_CLIENT_SECRET: string | undefined;
      ONPATIENT_CLIENT_ID: string | undefined;
      EPIC_CLIENT_ID: string | undefined;
      EPIC_CLIENT_ID_DSTU2: string | undefined;
      EPIC_CLIENT_ID_R4: string | undefined;
      EPIC_SANDBOX_CLIENT_ID: string | undefined;
      EPIC_SANDBOX_CLIENT_ID_DSTU2: string | undefined;
      EPIC_SANDBOX_CLIENT_ID_R4: string | undefined;
      CERNER_CLIENT_ID: string | undefined;
      VERADIGM_CLIENT_ID: string | undefined;
      VA_CLIENT_ID: string | undefined;
      IS_DEMO: 'enabled' | 'disabled';
      PUBLIC_URL: string;
    }
  }
}

export {};
