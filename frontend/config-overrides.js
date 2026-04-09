const path = require('path');
const webpack = require('webpack');

module.exports = function override(config) {
  config.experiments = {
    ...(config.experiments || {}),
    asyncWebAssembly: true,
  };

  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    crypto: path.resolve(__dirname, 'src/shims/crypto.js'),
  };
  config.resolve.fallback = {
    ...(config.resolve.fallback || {}),
    assert: require.resolve('assert/'),
    buffer: require.resolve('buffer/'),
    process: require.resolve('process/browser.js'),
    stream: require.resolve('stream-browserify'),
    vm: require.resolve('vm-browserify'),
  };

  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: ['process/browser.js'],
    }),
  );

  const oneOf = config.module?.rules?.find((rule) => Array.isArray(rule.oneOf))?.oneOf;
  const vendorWasmDir = path.resolve(__dirname, 'src/vendor');

  if (oneOf) {
    oneOf.unshift(
      {
        test: /\.wasm$/,
        include: vendorWasmDir,
        type: 'asset/resource',
      },
      {
        test: /\.wasm$/,
        exclude: vendorWasmDir,
        type: 'webassembly/async',
      },
    );

    for (const rule of oneOf) {
      if (Array.isArray(rule.exclude) && !rule.exclude.some((entry) => String(entry) === String(/\.wasm$/))) {
        rule.exclude.push(/\.wasm$/);
      }
    }
  }

  return config;
};
