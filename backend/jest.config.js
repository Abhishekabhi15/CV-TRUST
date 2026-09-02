/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,  // mongo-memory-server can be slow
  forceExit: true,
  detectOpenHandles: true,
};
