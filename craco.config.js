const path = require('path');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const SDK_DIR = require('./sdk.config');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@gocharting/chart-sdk': path.resolve(__dirname, SDK_DIR, 'dist'),
    },
    configure: (webpackConfig) => {
      // Allow imports from outside src/ (needed for local SDK alias)
      webpackConfig.resolve.plugins = webpackConfig.resolve.plugins.filter(
        plugin => !(plugin instanceof ModuleScopePlugin)
      );

      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: /node_modules\/(?!@gocharting)/,
      };

      // Disable source-map-loader for core-js packages to avoid ENOENT errors
      function fixRules(rules) {
        if (!rules) return;
        for (const rule of rules) {
          if (rule.enforce === 'pre') {
            const uses = rule.use || rule.loader;
            const hasSourceMap = JSON.stringify(uses || '').includes('source-map-loader');
            if (hasSourceMap) {
              const existing = rule.exclude
                ? (Array.isArray(rule.exclude) ? rule.exclude : [rule.exclude])
                : [];
              rule.exclude = [
                ...existing,
                /node_modules[\/\\]core-js/,
                /node_modules[\/\\]core-js-pure/,
              ];
            }
          }
          if (rule.oneOf) fixRules(rule.oneOf);
          if (rule.rules) fixRules(rule.rules);
        }
      }
      fixRules(webpackConfig.module.rules);
      return webpackConfig;
    },
  },
};
