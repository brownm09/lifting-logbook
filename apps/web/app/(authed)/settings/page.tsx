import type { Metadata } from 'next';
import Link from 'next/link';
import { SETTINGS_SECTIONS } from './sections';
import styles from './settings.module.css';

export const metadata: Metadata = {
  title: 'Settings — Lifting Logbook',
  description:
    'Manage training maxes, strength goals, schedule, and weight rounding, or import data from a CSV.',
};

/**
 * Data/tools entry points surfaced alongside the settings sections. Kept
 * separate from {@link SETTINGS_SECTIONS} because `/import` is a tool, not a
 * settings page, and must not appear in the settings sub-nav.
 */
const TOOLS: ReadonlyArray<{ href: string; label: string; description: string }> = [
  {
    href: '/import',
    label: 'Import data',
    description:
      'Bring in lift history, training maxes, strength goals, or a full program from a CSV file.',
  },
];

/**
 * Settings hub (`/settings`). The parent settings layout renders the "Settings"
 * heading and the section sub-nav; this page is the descriptive landing that
 * lists every section with a short summary and surfaces the (previously
 * orphaned) `/import` wizard (#679). Intentionally static — no data fetch — so
 * it always renders regardless of API state.
 */
export default function SettingsIndexPage() {
  return (
    <div className={styles.hub}>
      <section aria-labelledby="settings-sections-heading">
        <h2 id="settings-sections-heading" className={styles.groupHeading}>
          Sections
        </h2>
        <ul className={styles.cardGrid}>
          {SETTINGS_SECTIONS.map(({ href, label, description }) => (
            <li key={href}>
              <Link href={href} className={styles.card}>
                <span className={styles.cardTitle}>{label}</span>
                <span className={styles.cardDesc}>{description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="settings-tools-heading">
        <h2 id="settings-tools-heading" className={styles.groupHeading}>
          Data &amp; tools
        </h2>
        <ul className={styles.cardGrid}>
          {TOOLS.map(({ href, label, description }) => (
            <li key={href}>
              <Link href={href} className={styles.card}>
                <span className={styles.cardTitle}>{label}</span>
                <span className={styles.cardDesc}>{description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
