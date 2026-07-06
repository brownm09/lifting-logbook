import { render, screen, within } from '@testing-library/react';
import SettingsNav from './SettingsNav';
import { SETTINGS_SECTIONS } from './sections';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

import { usePathname } from 'next/navigation';

const mockedUsePathname = usePathname as unknown as jest.Mock;

describe('SettingsNav', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a labelled sub-nav with a tab per settings section', () => {
    mockedUsePathname.mockReturnValue('/settings');
    render(<SettingsNav />);

    const nav = within(screen.getByRole('navigation', { name: 'Settings sections' }));
    for (const { href, label } of SETTINGS_SECTIONS) {
      expect(nav.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
    expect(nav.getAllByRole('link')).toHaveLength(SETTINGS_SECTIONS.length);
  });

  it('marks the current section with aria-current and leaves siblings unmarked', () => {
    // aria-current stays set across a section's sub-routes, not just its index.
    mockedUsePathname.mockReturnValue('/settings/schedule');
    render(<SettingsNav />);

    expect(screen.getByRole('link', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Training Maxes' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Weight Rounding' })).not.toHaveAttribute('aria-current');
  });

  it('marks no tab active on the /settings hub itself', () => {
    mockedUsePathname.mockReturnValue('/settings');
    render(<SettingsNav />);

    for (const { label } of SETTINGS_SECTIONS) {
      expect(screen.getByRole('link', { name: label })).not.toHaveAttribute('aria-current');
    }
  });
});
