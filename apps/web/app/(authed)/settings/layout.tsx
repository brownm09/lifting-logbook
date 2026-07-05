import Link from 'next/link';
import SettingsNav from './SettingsNav';
import styles from './settings.module.css';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      <header>
        <h1>Settings</h1>
        <SettingsNav />
        <Link href="/cycle" className={styles.backLink}>
          ← Back to cycle
        </Link>
      </header>
      {children}
    </main>
  );
}
