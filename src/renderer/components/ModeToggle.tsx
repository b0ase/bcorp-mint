import React from 'react';
import type { AppMode } from '../lib/types';

type Props = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

const MODES: { value: AppMode; label: string }[] = [
  { value: 'stamp', label: 'Stamp' },
  { value: 'mint', label: 'Mint' },
  { value: 'tokenise', label: 'Tokenise' }
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
