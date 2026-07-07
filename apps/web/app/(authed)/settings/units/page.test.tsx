import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

jest.mock('@/lib/api', () => ({
  fetchUserSettings: jest.fn(),
}));

// Stub the client form so the test isolates the page's data-fetch fallback.
// It echoes the resolved unit so we can assert what the page passed down.
// initialUnit is a plain string | null (unlike weight-rounding's numeric prop), so
// render it directly rather than via JSON.stringify — stringifying a string wraps
// it in quote characters that React then HTML-escapes in the attribute output.
jest.mock('./UnitForm', () => ({
  __esModule: true,
  default: ({ initialUnit }: { initialUnit: string | null }) => (
    <div data-unit={initialUnit ?? 'null'}>unit-form</div>
  ),
}));

import { fetchUserSettings } from '@/lib/api';
import UnitsPage from './page';

const mockedFetch = fetchUserSettings as unknown as jest.Mock;

describe('UnitsPage — fetch fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the form with the fetched unit on success', async () => {
    mockedFetch.mockResolvedValue({
      activeProgram: null,
      workoutSchedule: null,
      defaultWeightIncrement: null,
      unit: 'kg',
    });

    const element = (await UnitsPage()) as ReactElement;
    const html = renderToStaticMarkup(element);

    expect(html).toContain('unit-form');
    // Data-level assertion: the real fetched unit reached the form.
    expect(html).toContain('data-unit="kg"');
  });

  it('falls back to a null unit (no throw) when the API is unreachable', async () => {
    mockedFetch.mockRejectedValue(new Error('API down'));

    const element = (await UnitsPage()) as ReactElement;
    const html = renderToStaticMarkup(element);

    expect(html).toContain('unit-form');
    // The fallback passes unit: null — distinct from any fetched value.
    expect(html).toContain('data-unit="null"');
  });
});
