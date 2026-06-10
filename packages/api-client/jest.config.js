const base = require('../../jest.config.base.js');
module.exports = {
  ...base,
  moduleNameMapper: {
    '^@lifting-logbook/types$': '<rootDir>/../types/src/index.ts',
  },
};
