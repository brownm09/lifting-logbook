'use strict';

const noUncoveredErrorFallback = require('./no-uncovered-error-fallback');

module.exports = {
  rules: {
    'no-uncovered-error-fallback': noUncoveredErrorFallback,
  },
};
