'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SETTINGS_SECTIONS } from './sections';
import styles from './settings.module.css';

/**
 * Sub-navigation for the settings area: one tab per settings section so a user
 * can move directly between Training Maxes, Strength Goals, Schedule, and Weight
 * Rounding — replacing the pre-#679 behaviour where "Settings" only ever opened
 * Training Maxes and the sibling pages were unreachable.
 *
 * Shares the shell nav's ({@link AppNav}) active-tab affordance (`aria-current` +
 * accent style), but deliberately matches with exact-or-subtree
 * (`pathname === href || pathname.startsWith(href + '/')`) rather than a plain
 * prefix — specifically so no tab lights up on the bare `/settings` hub and a
 * sibling-prefix route can't collide. (Encoded by the third SettingsNav test.)
 */
export default function SettingsNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Settings sections" className={styles.subNav}>
      {SETTINGS_SECTIONS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={active ? `${styles.subLink} ${styles.subActive}` : styles.subLink}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
