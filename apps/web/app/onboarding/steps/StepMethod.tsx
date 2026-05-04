'use client';

import styles from '../onboarding.module.css';
import type { DiscoveryMethod } from '../lib';

const METHOD_OPTIONS: { id: DiscoveryMethod; title: string; description: string }[] = [
  {
    id: 'estimate',
    title: 'Estimate from a recent lift',
    description:
      'Enter a recent set (weight × reps) and we’ll calculate your 1RM with the Brzycki formula.',
  },
  {
    id: 'test',
    title: 'Run a Test Week',
    description:
      'Spend a week working up to heavy singles in each lift. Best accuracy for experienced lifters.',
  },
  {
    id: 'manual',
    title: 'Enter manually',
    description:
      'You already know your 1RMs. Enter them directly and we’ll set training maxes at 90%.',
  },
];

type Props = {
  method: DiscoveryMethod;
  onSelect: (method: DiscoveryMethod) => void;
};

export function StepMethod({ method, onSelect }: Props) {
  return (
    <>
      <h2 className={styles.stepTitle}>How do you want to find your maxes?</h2>
      <p className={styles.stepHint}>
        Pick the option that matches your training history.
      </p>
      <div className={styles.optionList}>
        {METHOD_OPTIONS.map((opt) => {
          const cls = [
            styles.option,
            method === opt.id ? styles.optionSelected : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              type="button"
              key={opt.id}
              className={cls}
              onClick={() => onSelect(opt.id)}
              aria-pressed={method === opt.id}
            >
              <span className={styles.optionTitle}>{opt.title}</span>
              <span className={styles.optionDescription}>{opt.description}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
