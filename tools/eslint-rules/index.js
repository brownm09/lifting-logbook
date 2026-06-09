'use strict';

const noUncoveredErrorFallback = require('./no-uncovered-error-fallback');
const requireFetchCache = require('./require-fetch-cache');

module.exports = {
  rules: {
    'no-uncovered-error-fallback': noUncoveredErrorFallback,
    'require-fetch-cache': requireFetchCache,
  },
};
