const { composePlugins, withNx } = require('@nx/webpack');
const { IgnorePlugin } = require('webpack');

const optionalLazyImports = [
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets/socket-module',
  '@fastify/static',
  'supports-color',
];

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Note: This was added by an Nx migration. Webpack builds are required to have a corresponding Webpack config file.
  // See: https://nx.dev/recipes/webpack/webpack-config-setup
  config.plugins.push(
    new IgnorePlugin({
      checkResource: (resource) => optionalLazyImports.includes(resource),
    }),
  );
  return config;
});
