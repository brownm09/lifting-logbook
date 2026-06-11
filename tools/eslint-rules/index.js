'use strict';

const noUncoveredErrorFallback = require('./no-uncovered-error-fallback');
const requireFetchCache = require('./require-fetch-cache');
const noRawFetchOutsideApiClient = require('./no-raw-fetch-outside-api-client');

module.exports = {
  rules: {
    'no-uncovered-error-fallback': noUncoveredErrorFallback,
    'require-fetch-cache': requireFetchCache,
    'no-raw-fetch-outside-api-client': noRawFetchOutsideApiClient,
  },
};
