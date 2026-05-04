import Link from "next/link";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <h1 className={styles.wordmark}>Lifting Logbook</h1>
          <p className={styles.tagline}>Track your lifts. Run the program.</p>
        </div>
        <nav className={styles.ctaList} aria-label="Primary navigation">
          <Link href="/cycle" className={styles.cta}>
            <span>Current Cycle</span>
            <span className={styles.ctaArrow} aria-hidden="true">
              →
            </span>
          </Link>
          <Link href="/settings/training-maxes" className={styles.cta}>
            <span>Training Maxes</span>
            <span className={styles.ctaArrow} aria-hidden="true">
              →
            </span>
          </Link>
          <Link
            href="/onboarding"
            className={`${styles.cta} ${styles.ctaSecondary}`}
          >
            <span>Get Started</span>
            <span className={styles.ctaArrow} aria-hidden="true">
              →
            </span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
