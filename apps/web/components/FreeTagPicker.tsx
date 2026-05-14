'use client';

import { useState } from 'react';
import styles from './FreeTagPicker.module.css';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function FreeTagPicker({ value, onChange, placeholder, disabled }: Props) {
  const [draft, setDraft] = useState('');

  function commit() {
    const trimmed = draft.trim();
    if (trimmed) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  return (
    <div className={styles.chipList}>
      {value.map((tag) => (
        <span key={tag} className={styles.chip}>
          {tag}
          <button
            type="button"
            className={styles.chipRemove}
            aria-label={`Remove ${tag}`}
            onClick={() => remove(tag)}
            disabled={disabled}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className={styles.textInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
      />
    </div>
  );
}
