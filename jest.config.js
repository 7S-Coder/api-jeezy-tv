// jest.config.js
// Configuration Jest pour les tests

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "lib/**/*.ts",
    "!lib/**/*.d.ts",
    "!**/__tests__/**",
  ],
  coveragePathIgnorePatterns: ["/node_modules/"],
};
