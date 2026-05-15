'use client';

import { useState } from 'react';
import type { CustomProgramSummaryResponse } from '@lifting-logbook/types';
import BrowseTab from './BrowseTab';
import EditorTab from './EditorTab';
import styles from './programs.module.css';

type Tab = 'browse' | 'editor';

type Props = {
  activeProgram: string | null;
  customPrograms: CustomProgramSummaryResponse[];
};

export default function ProgramsTabs({ activeProgram, customPrograms }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [currentActive, setCurrentActive] = useState(activeProgram);

  function handleProgramSaved(id: string) {
    setCurrentActive(id);
    setActiveTab('browse');
  }

  return (
    <>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'browse' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          Browse Programs
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'editor' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          My Programs
        </button>
      </div>

      {activeTab === 'browse' && (
        <BrowseTab activeProgram={currentActive} />
      )}

      {activeTab === 'editor' && (
        <EditorTab
          activeProgram={currentActive}
          customPrograms={customPrograms}
          onProgramSaved={handleProgramSaved}
        />
      )}
    </>
  );
}
