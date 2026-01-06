const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { wrapWithAudioAPIMetroConfig } = require('react-native-audio-api/metro-config');

// 1. Get the base Expo config
const config = getDefaultConfig(__dirname);

// 2. Manually merge the resolver settings
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Force both imports to point to the web-ready ESM file
  '@google/genai': path.resolve(__dirname, 'node_modules/@google/genai/dist/web/index.mjs'),
  '@google/genai/web': path.resolve(__dirname, 'node_modules/@google/genai/dist/web/index.mjs'),
};

// 3. Add .mjs support
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'json'];

// 4. Force 'browser' conditions to avoid Node.js errors
config.resolver.unstable_conditionNames = ['browser', 'import', 'require'];
config.resolver.unstable_enablePackageExports = true;

// 5. Wrap and export
module.exports = wrapWithAudioAPIMetroConfig(config);