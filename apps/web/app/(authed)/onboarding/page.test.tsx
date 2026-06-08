import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { LIFT_NAMES } from '@lifting-logbook/types';

jest.mock('@/lib/api', () => ({
  fetchLiftCatalog: jest.fn(),
}));

jest.mock('@/lib/active-program', () => ({
  getActiveProgram: jest.fn().mockResolvedValue('5-3-1'),
}));

// Stub the client flow so the test isolates the page's catalog-fetch fallback.
// It echoes the resolved catalog so we can assert what the page passed down.
jest.mock('./OnboardingFlow', () => ({
  OnboardingFlow: ({ catalog }: { catalog: string[] }) => (
    <div data-catalog={JSON.stringify(catalog)}>onboarding-flow</div>
  ),
}));

import { fetchLiftCatalog } from '@/lib/api';
import OnboardingPage from './page';
import { DEFAULT_LIFTS } from './lib';

const mockedFetch = fetchLiftCatalog as unknown as jest.Mock;

describe('OnboardingPage — catalog fetch fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the fetched catalog to the flow on success', async () => {
    const fetched = ['Squat', 'Bench Press', 'My Custom Lift'];
    mockedFetch.mockResolvedValue(fetched);

    const element = (await OnboardingPage()) as ReactElement;
    const html = renderToStaticMarkup(element);

    expect(html).toContain('onboarding-flow');
    // Data-level assertion: the real fetched catalog — including the custom
    // lift that no fallback would produce — reached the flow.
    expect(html).toContain('My Custom Lift');
  });

  it('falls back to the full built-in LIFT_NAMES when the fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('API down'));
    // Silence the intentional error log this path emits.
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const element = (await OnboardingPage()) as ReactElement;
    const html = renderToStaticMarkup(element);

    expect(html).toContain('onboarding-flow');

    // The fallback must be the full built-in catalog, NOT the three seeded
    // DEFAULT_LIFTS. Overhead Press is in LIFT_NAMES but not DEFAULT_LIFTS, so
    // its presence proves the picker stays searchable when the API is down (#458).
    const overheadInDefaults = (DEFAULT_LIFTS as readonly string[]).includes('Overhead Press');
    expect(overheadInDefaults).toBe(false);
    expect(LIFT_NAMES).toContain('Overhead Press');
    expect(html).toContain('Overhead Press');

    // The catalog handed down is exactly the built-in list.
    expect(html).toContain(`data-catalog="${JSON.stringify([...LIFT_NAMES]).replace(/"/g, '&quot;')}"`);

    // The failure is surfaced, not silently swallowed.
    expect(errSpy).toHaveBeenCalledWith(
      'OnboardingPage: lift catalog fetch failed, falling back to built-in LIFT_NAMES',
      expect.any(Error),
    );
    errSpy.mockRestore();
  });
});
