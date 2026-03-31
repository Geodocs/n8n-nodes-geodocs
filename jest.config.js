module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/nodes', '<rootDir>/credentials'],
  testMatch: ['**/*.spec.ts'],
};
