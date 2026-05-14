'use client';

import { useEffect, useRef, useState } from 'react';
import { LIFT_CATALOG } from '@lifting-logbook/core';
import styles from './CatalogTagPicker.module.css';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

const CATALOG_NAMES = LIFT_CATALOG.map((l) => l.name);

export default function CatalogTagPicker({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = CATALOG_NAMES.filter(
    (name) =>
      !value.includes(name) &&
      name.toLowerCase().includes(query.toLowerCase()),
  );
  const open = query.trim() !== '' && filtered.length > 0;

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function select(name: string) {
    onChange([...value, name]);
    setQuery('');
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div className={styles.chipList}>
        {value.map((name) => (
          <span key={name} className={styles.chip}>
            {name}
            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`Remove ${name}`}
              onClick={() => remove(name)}
              disabled={disabled}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className={styles.textInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value.length === 0 ? 'Search lifts…' : ''}
          disabled={disabled}
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </div>
      {open && (
        <ul className={styles.dropdown} role="listbox">
          {filtered.map((name) => (
            <li key={name}>
              <button
                type="button"
                className={styles.option}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur before select fires
                  select(name);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
