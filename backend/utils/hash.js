/**
 * Cryptographic hashing utilities.
 * hashFile(filePath)  → SHA-256 hex digest of a file
 * hashObject(obj)     → SHA-256 hex digest of a deterministically serialised object
 * hashString(str)     → SHA-256 hex digest of a string
 */
const crypto = require('crypto');
const fs = require('fs');

/**
 * Compute SHA-256 hash of a file by streaming it.
 * @param {string} filePath  Absolute or relative path to the file
 * @returns {Promise<string>} 64-character lowercase hex string
 */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Deterministically serialise a value:
 * - Plain objects: keys sorted recursively
 * - Arrays: elements serialised recursively (order preserved)
 * - Primitives: returned as-is for JSON.stringify
 *
 * This ensures that { b: 2, a: 1 } and { a: 1, b: 2 } produce the same hash,
 * while { label: 'car', confidence: 0.95 } and { label: 'truck', confidence: 0.99 }
 * produce DIFFERENT hashes.
 */
function sortedReplacer(_key, value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    // Sort keys and return a new object with sorted keys
    return Object.keys(value)
      .sort()
      .reduce((sorted, k) => {
        sorted[k] = value[k];
        return sorted;
      }, {});
  }
  return value;
}

/**
 * Compute SHA-256 hash of an arbitrary object (recursively sorted keys).
 * @param {*} obj  Any JSON-serialisable value
 * @returns {string} 64-character lowercase hex string
 */
function hashObject(obj) {
  const json = JSON.stringify(obj, sortedReplacer);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Compute SHA-256 hash of a plain string.
 * @param {string} str
 * @returns {string} 64-character lowercase hex string
 */
function hashString(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

module.exports = { hashFile, hashObject, hashString };
