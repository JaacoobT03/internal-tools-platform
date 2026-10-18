/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tools'],
  testMatch: ['**/*.test.cjs'],
  testTimeout: 60000,
};
