import * as server from 'http-proxy';

export const PROXY_MODULE_OPTIONS = 'ProxyModuleOptions';
export const HTTP_PROXY = 'httpProxy';

export const defaultProxyOptions: server.ServerOptions = {
  changeOrigin: true,
  timeout: 60000 * 5,
};
