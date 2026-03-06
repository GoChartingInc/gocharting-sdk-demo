const path = require('path');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@gocharting/chart-sdk': path.resolve(__dirname, '../gocharting-web-sdk/GoCharting-SDK/dist'),
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
      // Walk all rules recursively to find source-map-loader
      function fixRules(rules) {
        if (!rules) return;
        for (const rule of rules) {
          if (rule.enforce === 'pre') {
            // Check if this rule uses source-map-loader
            const uses = rule.use || rule.loader;
            const hasSourceMap = JSON.stringify(uses || '').includes('source-map-loader');
            if (hasSourceMap) {
              rule.exclude = [
                ...(rule.exclude || []),
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

