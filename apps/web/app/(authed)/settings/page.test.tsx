import { render, screen, within } from '@testing-library/react';
import SettingsIndexPage from './page';
import { SETTINGS_SECTIONS } from './sections';

describe('Settings hub (index)', () => {
  it('links to all four settings sections with a description each', () => {
    render(<SettingsIndexPage />);

    // Scope to the "Sections" region so the section links can never collide with
    // the Import card (whose description also mentions "training maxes").
    const sections = within(screen.getByRole('region', { name: 'Sections' }));

    for (const { href, label, description } of SETTINGS_SECTIONS) {
      const link = sections.getByRole('link', { name: new RegExp(label, 'i') });
      expect(link).toHaveAttribute('href', href);
      expect(sections.getByText(description)).toBeInTheDocument();
    }

    // Exactly the four sections — no extra/missing cards.
    expect(sections.getAllByRole('link')).toHaveLength(SETTINGS_SECTIONS.length);
  });

  it('surfaces the previously-orphaned Import wizard as a data/tools entry point', () => {
    render(<SettingsIndexPage />);

    const tools = within(screen.getByRole('region', { name: /Data & tools/i }));
    const importLink = tools.getByRole('link', { name: /Import data/i });
    expect(importLink).toHaveAttribute('href', '/import');
  });

  it('groups the sections and tools under their own headings', () => {
    render(<SettingsIndexPage />);

    expect(screen.getByRole('heading', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Data & tools/i })).toBeInTheDocument();
  });
});
