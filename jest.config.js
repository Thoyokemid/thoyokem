/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: {
    // Generated Prisma Client is ESM-only; tests never need a real DB
    // connection (only pure functions from files that import lib/db are
    // under test), so point at the manual mock instead.
    '^@/lib/db$': '<rootDir>/__mocks__/lib/db.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
