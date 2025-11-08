const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// Some versions of metro-config return a config object with resolver field structure
const assetExts = (defaultConfig.resolver && defaultConfig.resolver.assetExts) ? [...defaultConfig.resolver.assetExts] : (defaultConfig.assetExts || []);
const sourceExts = (defaultConfig.resolver && defaultConfig.resolver.sourceExts) ? [...defaultConfig.resolver.sourceExts] : (defaultConfig.sourceExts || []);

// remove svg from assetExts and ensure svg is in sourceExts
const filteredAssetExts = assetExts.filter(ext => ext !== 'svg');
if (!sourceExts.includes('svg')) sourceExts.push('svg');

const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    allowOptionalDependencies: true,
  },
  resolver: {
    assetExts: filteredAssetExts,
    sourceExts,
  },
};

module.exports = mergeConfig(defaultConfig, config);
