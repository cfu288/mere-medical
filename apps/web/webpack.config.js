const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const nxReactBaseConfig = require('@nx/react/plugins/webpack');
const { DefinePlugin } = require('webpack');
const { merge } = require('webpack-merge');
const { InjectManifest } = require('workbox-webpack-plugin');
const path = require('path');

const commitHash = require('child_process')
  .execSync('git describe --tag')
  .toString()
  .trim();

function myCustomPlugin() {
  // `options` and `context` are the target options and
  // `@nx/webpack:webpack` executor context respectively.
  // `config` is the Webpack configuration object
  return async (config, { options, context }) => {
    // https://nx.dev/packages/webpack/documents/webpack-config-setup
    // Fix that Nx uses a different attribute when serving the app
    context.options = context.options || context.buildOptions;
    const mergeWebpackConfigs = [
      config,
      {
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
        ignoreWarnings: [/Failed to parse source map/],
        mode: config.mode,
      },
    ];

    // For production we add the service worker
    // if (config.mode === 'production') {
    //   mergeWebpackConfigs.push({
    //     plugins: [
    //       new InjectManifest({
    //         swSrc: path.resolve(
    //           context.root,
    //           'apps',
    //           'web',
    //           'src',
    //           'service-worker.ts',
    //         ),
    //         dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
    //         exclude: [/\.map$/, /asset-manifest\.json$/, /LICENSE/],
    //         maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    //         // this is the output of the plugin,
    //         // relative to webpack's output directory
    //         swDest: 'service-worker.js',
    //       }),
    //     ],
    //   });
    // }

    return merge(...mergeWebpackConfigs);
  };
}

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), withReact(), myCustomPlugin());
