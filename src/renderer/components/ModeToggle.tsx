import React from 'react';
import type { AppMode } from '../lib/types';

type Props = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

const MODES: { value: AppMode; label: string }[] = [
  { value: 'watch', label: 'Watch' },
  { value: 'mix', label: 'Mix' },
  { value: 'stamp', label: 'Stamp' },
  { value: 'cover', label: 'Cover' },
  { value: 'titles', label: 'Titles' },
  { value: 'export', label: 'Export' },
  { value: 'mint', label: 'Mint' },
  { value: 'ticket', label: 'Ticket' },
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
