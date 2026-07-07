import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

jest.mock('@/lib/api', () => ({
  fetchUserSettings: jest.fn(),
}));

// Stub the client form so the test isolates the page's data-fetch fallback.
// It echoes the resolved increment so we can assert what the page passed down.
jest.mock('./WeightIncrementForm', () => ({
  __esModule: true,
  default: ({ initialIncrement }: { initialIncrement: unknown }) => (
    <div data-increment={JSON.stringify(initialIncrement)}>weight-increment-form</div>
  ),
}));

import { fetchUserSettings } from '@/lib/api';
import WeightRoundingPage from './page';

const mockedFetch = fetchUserSettings as unknown as jest.Mock;

describe('WeightRoundingPage — fetch fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the form with the fetched increment on success', async () => {
    mockedFetch.mockResolvedValue({
      activeProgram: null,
      workoutSchedule: null,
      defaultWeightIncrement: 0.625,
      unit: null,
    });

    const element = (await WeightRoundingPage()) as ReactElement;
    const html = renderToStaticMarkup(element);

    expect(html).toContain('weight-increment-form');
    // Data-level assertion: the real fetched increment reached the form.
    expect(html).toContain('data-increment="0.625"');
  });

  it('falls back to a null increment (no throw) when the API is unreachable', async () => {
    mockedFetch.mockRejectedValue(new Error('API down'));

    const element = (await WeightRoundingPage()) as ReactElement;
    const html = renderToStaticMarkup(element);

    expect(html).toContain('weight-increment-form');
    // The fallback passes defaultWeightIncrement: null — distinct from any fetched value.
    expect(html).toContain('data-increment="null"');
  });
});
