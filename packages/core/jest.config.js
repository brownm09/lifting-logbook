const base = require('../../jest.config.base.js');
module.exports = {
  ...base,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@src/core(.*)$': '<rootDir>/src$1',
    '^@lifting-logbook/types$': '<rootDir>/../types/src/index.ts',
  },
};
