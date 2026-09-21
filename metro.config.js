// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build imports wa-sqlite.wasm. The static export resolves it,
// but the dev server's render pass does not unless wasm is a known asset type,
// which made `npm run web` fail to bundle.
config.resolver.assetExts.push('wasm');

module.exports = config;
