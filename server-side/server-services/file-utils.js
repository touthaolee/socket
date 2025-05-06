// file-utils.js
// Utility for atomic file writes to prevent data corruption
const fs = require('fs');
const path = require('path');

/**
 * Atomically writes data to a file by writing to a temp file and renaming.
 * @param {string} filePath - The target file path.
 * @param {string|Buffer} data - The data to write.
 * @param {object} [options] - fs.writeFileSync options.
 */
function atomicWriteFileSync(filePath, data, options) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `.${path.basename(filePath)}.tmp`);
  fs.writeFileSync(tempFile, data, options);
  fs.renameSync(tempFile, filePath);
}

module.exports = { atomicWriteFileSync };