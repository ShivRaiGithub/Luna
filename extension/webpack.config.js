const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  experiments: {
    asyncWebAssembly: true,
  },
  entry: {
    popup: './src/popup/index.tsx',
    background: './src/background/index.ts',
    offscreen: './src/offscreen/index.ts',
    content: './src/content/index.ts',
    injected: './src/content/injected.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.wasm$/,
        include: path.resolve(__dirname, 'src/vendor'),
        type: 'asset/resource',
      },
      {
        test: /\.wasm$/,
        exclude: path.resolve(__dirname, 'src/vendor'),
        type: 'webassembly/async',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      crypto: path.resolve(__dirname, 'src/shims/crypto.js'),
    },
    modules: [
      path.resolve(__dirname, 'src'),
      'node_modules',
      path.resolve(__dirname, '../frontend/node_modules'),
    ],
    fallback: {
      assert: require.resolve('assert/'),
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser.js'),
      stream: require.resolve('stream-browserify'),
      vm: require.resolve('vm-browserify'),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: './src/offscreen/offscreen.html',
      filename: 'offscreen.html',
      chunks: ['offscreen'],
    }),
    new CopyPlugin({
      patterns: [
        { from: 'public/manifest.json', to: 'manifest.json' },
        {
          from: 'public/icons',
          to: 'icons',
          noErrorOnMissing: true,
        },
      ],
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: ['process/browser.js'],
    }),
  ],
};
