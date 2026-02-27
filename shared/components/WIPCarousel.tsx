'use client';

import React, { useMemo } from 'react';
import type { AppMode, WIPItem } from '@shared/lib/types';

type Props = {
  items: WIPItem[];
  currentMode: AppMode;
  activeItemId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export default function WIPCarousel({ items, currentMode, activeItemId, onSelect, onNew }: Props) {
  const filtered = useMemo(
    () => items.filter((w) => w.mode === currentMode),
    [items, currentMode],
  );

  return (
    <div className="wip-carousel">
      {filtered.map((item) => (
        <button
          key={item.id}
          className={`wip-chip ${item.id === activeItemId ? 'active' : ''}`}
          onClick={() => onSelect(item.id)}
          title={item.name}
        >
          {item.thumbnail && (
            <img className="wip-chip-thumb" src={item.thumbnail} alt="" />
          )}
          <span className="wip-chip-label">{item.name}</span>
        </button>
      ))}
      <button className="wip-chip wip-new" onClick={onNew}>
        + New
      </button>
    </div>
  );
}
