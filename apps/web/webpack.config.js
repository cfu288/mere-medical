const nxReactBaseConfig = require('@nrwl/react/plugins/webpack');
const { merge } = require('webpack-merge');
const { InjectManifest } = require('workbox-webpack-plugin');
const path = require('path');

module.exports = function (webpackConfig, nxConfig) {
  // Fix that Nx uses a different attribute when serving the app
  nxConfig.options = nxConfig.options || nxConfig.buildOptions;
  const config = nxReactBaseConfig(webpackConfig);

  const mergeWebpackConfigs = [config];
  mergeWebpackConfigs.push({
    // devServer: {
    //   devMiddleware: {
    //     writeToDisk: true,
    //   },
    // },
    resolve: {
      // ...
      fallback: {
        // 👇️👇️👇️ add this 👇️👇️👇️
        assert: false,
      },
    },
  });
  // For production we add the service worker
  if (config.mode === 'production') {
    mergeWebpackConfigs.push({
      plugins: [
        new InjectManifest({
          swSrc: path.resolve(
            nxConfig.options.root,
            nxConfig.options.sourceRoot,
            'service-worker.ts'
          ),
          dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
          exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // this is the output of the plugin,
          // relative to webpack's output directory
          swDest: 'service-worker.js',
        }),
      ],
    });
  }

  return merge(mergeWebpackConfigs);
};
