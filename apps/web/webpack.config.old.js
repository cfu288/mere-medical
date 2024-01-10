const nxReactBaseConfig = require('@nx/react/plugins/webpack');
const { DefinePlugin } = require('webpack');
const { merge } = require('webpack-merge');
const { InjectManifest } = require('workbox-webpack-plugin');
const path = require('path');
const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');

const commitHash = require('child_process')
  .execSync('git describe --tag')
  .toString()
  .trim();

console.log(JSON.stringify(commitHash));

module.exports = function (webpackConfig, nxConfig) {
  // Fix that Nx uses a different attribute when serving the app
  nxConfig.options = nxConfig.options || nxConfig.buildOptions;
  const config = nxReactBaseConfig(webpackConfig);

  const mergeWebpackConfigs = [config];
  mergeWebpackConfigs.push({
    resolve: {
      fallback: {
        assert: false,
        fs: false,
      },
    },
    devtool: 'source-map', // Source map generation must be turned on
    plugins: [
      new DefinePlugin({
        MERE_APP_VERSION: JSON.stringify(commitHash),
      }),
    ],
  });

  // For production we add the service worker
  if (config.mode === 'production') {
    mergeWebpackConfigs.push({
      plugins: [
        new InjectManifest({
          swSrc: path.resolve(
            nxConfig.root,
            'apps',
            'web',
            'src',
            'service-worker.ts'
          ),
          dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
          exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // this is the output of the plugin,
          // relative to webpack's output directory
          swDest: 'service-worker.js',
        }),
        sentryWebpackPlugin({
          authToken: process.env.SENTRY_AUTH_TOKEN,
          org: 'mere-medical',
          project: 'mere-web',
          url: 'https://sentry.meremedical.co/',
        }),
      ],
    });
  }

  return merge(mergeWebpackConfigs);
};
