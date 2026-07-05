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
 * Mirrors the shell nav ({@link AppNav}): the active tab carries `aria-current`
 * and the accent style. No tab is active on the `/settings` hub itself.
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
