const cryptoBrowserify = require('crypto-browserify');

const webCrypto = globalThis.crypto || {};

module.exports = Object.assign({}, cryptoBrowserify, {
  subtle: webCrypto.subtle,
  getRandomValues: webCrypto.getRandomValues ? webCrypto.getRandomValues.bind(webCrypto) : undefined,
  randomUUID: webCrypto.randomUUID ? webCrypto.randomUUID.bind(webCrypto) : undefined,
});
