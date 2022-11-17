declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      ONPATIENT_REDIRECT_URI: string;
      ONPATIENT_CLIENT_ID: string;
      PUBLIC_URL: string;
      TEST_VAR: string;
    }
  }
}

export {};
