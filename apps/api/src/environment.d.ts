declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      ONPATIENT_CLIENT_SECRET: string;
      ONPATIENT_CLIENT_ID: string;
      ONPATIENT_REDIRECT_URI: string;
      PUBLIC_URL: string;
    }
  }
}

export {};
