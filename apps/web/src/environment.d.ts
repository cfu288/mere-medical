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
  var MERE_APP_VERSION: number;
  interface Window {
    electron: {
      getAppVersion: () => Promise<string>;
      platform: string;
      onExternalNavigate: (callback: (arg0: any) => void) => void;
    };
  }
}

export {};
