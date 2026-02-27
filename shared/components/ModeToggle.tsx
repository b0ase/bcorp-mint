import React from 'react';
import type { AppMode } from '@shared/lib/types';

type Props = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

const MODES: { value: AppMode; label: string }[] = [
  { value: 'stamp', label: 'Stamp' },
  { value: 'currency', label: 'Currency' },
  { value: 'tokenise', label: 'Tokenise' },
  { value: 'music', label: 'Music' },
  { value: 'magazine', label: 'Magazine' },
];

export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mode-toggle">
      {MODES.map((m) => (
        <button
          key={m.value}
          className={`mode-toggle-btn ${mode === m.value ? 'active' : ''}`}
          onClick={() => onChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
