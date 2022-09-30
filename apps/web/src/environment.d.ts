declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      NX_ONPATIENT_REDIRECT_URI: string;
      NX_ONPATIENT_CLIENT_ID: string;
      NX_DATABASE_NAME: string;
      NX_PUBLIC_URL: string;
    }
  }
}

export {};
