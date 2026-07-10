import {
  DEFAULT_CORS_ORIGINS,
  LOCAL_DEV_ORIGINS,
  resolveCorsOrigins,
} from './cors.config';

// Unit coverage for the CORS allowlist that gates browser → API writes (ADR-028/ADR-032).
// resolveCorsOrigins takes its env values as parameters, so these tests never touch
// process.env or bootstrap Nest.
describe('resolveCorsOrigins', () => {
  describe('deployed environments (NODE_ENV set by deploy.yml)', () => {
    it.each(['production', 'staging'])(
      'returns the deployed allowlist with NO localhost origins when NODE_ENV=%s',
      (nodeEnv) => {
        const origins = resolveCorsOrigins(undefined, nodeEnv);

        // Every deployed origin is present...
        for (const expected of DEFAULT_CORS_ORIGINS) {
          expect(origins).toContain(expected);
        }
        // ...and no local-dev origin leaks into a deployed allowlist.
        for (const local of LOCAL_DEV_ORIGINS) {
          expect(origins).not.toContain(local);
        }
      },
    );

    it('allows the prod custom domain (apex and www)', () => {
      const origins = resolveCorsOrigins(undefined, 'production');
      expect(origins).toContain('https://liftinglogbook.com');
      expect(origins).toContain('https://www.liftinglogbook.com');
    });

    it('allows BOTH Cloud Run address formats for each web service', () => {
      const origins = resolveCorsOrigins(undefined, 'production');
      // Legacy hash format (what status.url reports)...
      expect(origins).toContain('https://lifting-logbook-prod-web-fvijrjuzmq-uc.a.run.app');
      expect(origins).toContain('https://lifting-logbook-stg-web-mn3pkptvma-uc.a.run.app');
      // ...and the project-number format Cloud Run also serves them at.
      expect(origins).toContain(
        'https://lifting-logbook-prod-web-508649171914.us-central1.run.app',
      );
      expect(origins).toContain(
        'https://lifting-logbook-stg-web-910635705567.us-central1.run.app',
      );
    });

    // Regression for the exact origin the staging integration suite sends: it loads the app
    // from the project-number URL, not the hash URL status.url reports. An allowlist keyed
    // only on the hash format would reject this preflight and fail the staging gate.
    it('allows the project-number origin the staging integration tests actually use', () => {
      const origins = resolveCorsOrigins(undefined, 'staging');
      expect(origins).toContain(
        'https://lifting-logbook-stg-web-910635705567.us-central1.run.app',
      );
    });
  });

  describe('local development (NODE_ENV unset or non-deployed)', () => {
    it.each([undefined, 'development', 'test'])(
      'appends localhost dev origins when NODE_ENV=%s',
      (nodeEnv) => {
        const origins = resolveCorsOrigins(undefined, nodeEnv);
        for (const local of LOCAL_DEV_ORIGINS) {
          expect(origins).toContain(local);
        }
        // Deployed origins remain available for local testing against real services.
        expect(origins).toContain('https://liftinglogbook.com');
      },
    );
  });

  describe('CORS_ALLOWED_ORIGINS override', () => {
    it('fully replaces the built-in list (no defaults, no localhost) when set', () => {
      const origins = resolveCorsOrigins(
        'https://a.example,https://b.example',
        'production',
      );
      expect(origins).toEqual(['https://a.example', 'https://b.example']);
    });

    it('trims whitespace and drops blank entries', () => {
      const origins = resolveCorsOrigins(
        '  https://a.example ,, https://b.example  , ',
        'production',
      );
      expect(origins).toEqual(['https://a.example', 'https://b.example']);
    });

    it('falls through to the built-in list when the override is empty or whitespace-only', () => {
      const origins = resolveCorsOrigins('   ', 'production');
      expect(origins).toEqual([...DEFAULT_CORS_ORIGINS]);
    });
  });
});
