declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      NX_ONPATIENT_CLIENT_SECRET: string;
      NX_ONPATIENT_CLIENT_ID: string;
      NX_ONPATIENT_REDIRECT: string;
      NX_FRONTEND_APP_REDIRECT: string;
    }
  }
}

export {};
