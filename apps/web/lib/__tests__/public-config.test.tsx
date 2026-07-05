import { render, screen } from '@testing-library/react';
import {
  PUBLIC_CONFIG_FALLBACK,
  getClientPublicConfig,
  publicConfigScript,
  readServerClerkPublishableKey,
  readServerPublicConfig,
  type PublicConfig,
} from '../public-config';
import { PublicConfigProvider, usePublicConfig } from '@/components/PublicConfigProvider';

// Public config is injected at runtime, not baked into the bundle at build time
// (#396 / ADR-028). These tests lock down: (1) server-side assembly from process.env,
// (2) the inline-script serialization + <script> escaping, (3) browser-side read of the
// injected window global, and (4) the React provider/hook delivery path.

describe('readServerPublicConfig', () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('reads the runtime (non-NEXT_PUBLIC) env vars', () => {
    process.env.PUBLIC_API_URL = 'https://api.prod.example';
    process.env.DEFAULT_PROGRAM = 'madcow';
    process.env.DEV_AUTH_TOKEN = 'tok';
    expect(readServerPublicConfig()).toEqual({
      apiUrl: 'https://api.prod.example',
      defaultProgram: 'madcow',
      devAuthToken: 'tok',
    });
  });

  it('falls back to dev defaults and omits devAuthToken when unset', () => {
    delete process.env.PUBLIC_API_URL;
    delete process.env.DEFAULT_PROGRAM;
    delete process.env.DEV_AUTH_TOKEN;
    const config = readServerPublicConfig();
    expect(config).toEqual({
      apiUrl: PUBLIC_CONFIG_FALLBACK.apiUrl,
      defaultProgram: PUBLIC_CONFIG_FALLBACK.defaultProgram,
    });
    expect('devAuthToken' in config).toBe(false);
  });

  // Fail-loud guard: in a deployed runtime a missing/empty PUBLIC_API_URL must throw rather
  // than silently fall back to localhost (which would ship a broken prod image — #395/#458).
  it('throws in a deployed runtime when PUBLIC_API_URL is unset', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    delete process.env.PUBLIC_API_URL;
    expect(() => readServerPublicConfig()).toThrow(/PUBLIC_API_URL is not set/);
  });

  it('throws in a deployed runtime when PUBLIC_API_URL is the empty string', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    process.env.PUBLIC_API_URL = '';
    expect(() => readServerPublicConfig()).toThrow(/PUBLIC_API_URL is not set/);
  });

  it('does NOT throw during `next build` even with PUBLIC_API_URL unset', () => {
    // The keyless build the force-dynamic root layout relies on must never throw here.
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    process.env.NEXT_PHASE = 'phase-production-build';
    delete process.env.PUBLIC_API_URL;
    expect(readServerPublicConfig().apiUrl).toBe(PUBLIC_CONFIG_FALLBACK.apiUrl);
  });
});

describe('readServerClerkPublishableKey', () => {
  const ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('returns the publishable key when it is set', () => {
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
    expect(readServerClerkPublishableKey()).toBe('pk_test_abc');
  });

  it('returns undefined outside a deployed runtime when the key is unset (local dev / test)', () => {
    delete process.env.CLERK_PUBLISHABLE_KEY;
    expect(readServerClerkPublishableKey()).toBeUndefined();
  });

  // Fail-loud guard: a deployed runtime missing the Clerk publishable key must throw rather
  // than hand <ClerkProvider> an undefined key that breaks auth silently in the browser (#687).
  it('throws in a deployed runtime when CLERK_PUBLISHABLE_KEY is unset', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    delete process.env.CLERK_PUBLISHABLE_KEY;
    expect(() => readServerClerkPublishableKey()).toThrow(/CLERK_PUBLISHABLE_KEY is not set/);
  });

  it('throws in a deployed runtime when CLERK_PUBLISHABLE_KEY is the empty string', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    process.env.CLERK_PUBLISHABLE_KEY = '';
    expect(() => readServerClerkPublishableKey()).toThrow(/CLERK_PUBLISHABLE_KEY is not set/);
  });

  it('does NOT throw during `next build` even with CLERK_PUBLISHABLE_KEY unset', () => {
    // The keyless build the force-dynamic root layout relies on must never throw here (ADR-028).
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    process.env.NEXT_PHASE = 'phase-production-build';
    delete process.env.CLERK_PUBLISHABLE_KEY;
    expect(readServerClerkPublishableKey()).toBeUndefined();
  });
});

describe('publicConfigScript', () => {
  it('assigns the serialized config to the window global', () => {
    const config: PublicConfig = { apiUrl: 'https://api.test', defaultProgram: '5-3-1' };
    expect(publicConfigScript(config)).toBe(
      `window.__PUBLIC_CONFIG__=${JSON.stringify(config)};`,
    );
  });

  it('escapes "<" so a value cannot break out of the <script> element', () => {
    const config: PublicConfig = { apiUrl: 'https://x/</script>', defaultProgram: '5-3-1' };
    const script = publicConfigScript(config);
    expect(script).not.toContain('</script>');
    expect(script).toContain('\\u003c/script>');
  });
});

describe('getClientPublicConfig', () => {
  afterEach(() => {
    delete window.__PUBLIC_CONFIG__;
  });

  it('returns the runtime-injected window config when present', () => {
    window.__PUBLIC_CONFIG__ = { apiUrl: 'https://injected', defaultProgram: 'x' };
    expect(getClientPublicConfig()).toEqual({ apiUrl: 'https://injected', defaultProgram: 'x' });
  });

  it('falls back to dev defaults when the window global is absent', () => {
    delete window.__PUBLIC_CONFIG__;
    expect(getClientPublicConfig()).toEqual(PUBLIC_CONFIG_FALLBACK);
  });
});

describe('PublicConfigProvider / usePublicConfig', () => {
  function Probe() {
    const { apiUrl, defaultProgram } = usePublicConfig();
    return (
      <span>
        {apiUrl}|{defaultProgram}
      </span>
    );
  }

  it('delivers the provided config to consumers', () => {
    render(
      <PublicConfigProvider config={{ apiUrl: 'https://ctx', defaultProgram: 'ctxprog' }}>
        <Probe />
      </PublicConfigProvider>,
    );
    expect(screen.getByText('https://ctx|ctxprog')).toBeInTheDocument();
  });
});
