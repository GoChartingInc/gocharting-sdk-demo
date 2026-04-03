// Single source of truth for the local SDK path
const SDK_DIR = '../gocharting-web-sdk/GoCharting-SDK';

// When run directly (node sdk.config.js), print the path for shell scripts
if (require.main === module) {
  const path = require('path');
  process.stdout.write(path.resolve(__dirname, SDK_DIR));
}

module.exports = SDK_DIR;
