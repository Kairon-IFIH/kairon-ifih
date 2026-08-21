/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@kairon/shared-kernel$": "<rootDir>/packages/shared-kernel/src/index.ts",
    "^@kairon/logger$": "<rootDir>/packages/logger/src/index.ts",
    "^@kairon/event-contracts$": "<rootDir>/packages/event-contracts/src/index.ts",
    "^@kairon/api-contracts$": "<rootDir>/packages/api-contracts/src/index.ts",
    "^@kairon/identity$": "<rootDir>/packages/identity/src/index.ts",
    "^@kairon/asset$": "<rootDir>/packages/asset/src/index.ts",
    "^@kairon/compliance$": "<rootDir>/packages/compliance/src/index.ts",
    "^@kairon/risk$": "<rootDir>/packages/risk/src/index.ts",
    "^@kairon/financial$": "<rootDir>/packages/financial/src/index.ts",
    "^@kairon/quantum$": "<rootDir>/packages/quantum/src/index.ts",
    "^@kairon/audit$": "<rootDir>/packages/audit/src/index.ts",
    "^@kairon/notification$": "<rootDir>/packages/notification/src/index.ts"
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.base.json" }]
  }
};
