/* eslint-disable no-var */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      ONPATIENT_CLIENT_ID: string;
      PUBLIC_URL: string;
      TEST_VAR: string;
    }
  }
  var MERE_APP_VERSION: string;
  var IS_DEMO: string;
}

export {};
