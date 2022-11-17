declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      ONPATIENT_CLIENT_SECRET: string | undefined;
      ONPATIENT_CLIENT_ID: string | undefined;
      PUBLIC_URL: string;
    }
  }
}

export {};
