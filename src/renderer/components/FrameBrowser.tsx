import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ExtractedFrame } from '../lib/types';

type ViewMode = 'grid' | 'timeline';

type Props = {
  frames: ExtractedFrame[];
  selectedIds: Set<string>;
  onSelectFrame: (id: string, multi?: boolean) => void;
  onSelectRange: (ids: string[]) => void;
  onSelectEveryNth: (n: number) => void;
  onSelectAll: () => void;
};

export default function FrameBrowser({
  frames,
  selectedIds,
  onSelectFrame,
  onSelectRange,
  onSelectEveryNth,
  onSelectAll
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [columns, setColumns] = useState(6);
  const [nthValue, setNthValue] = useState(10);
  const lastClickedRef = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const selectedCount = useMemo(() => {
    return frames.filter((f) => selectedIds.has(f.id)).length;
  }, [frames, selectedIds]);

  const handleFrameClick = useCallback((frame: ExtractedFrame, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRef.current !== null) {
      // Range selection
      const start = Math.min(lastClickedRef.current, index);
      const end = Math.max(lastClickedRef.current, index);
      const rangeIds = frames.slice(start, end + 1).map((f) => f.id);
      onSelectRange(rangeIds);
    } else {
      onSelectFrame(frame.id, e.metaKey || e.ctrlKey);
    }
    lastClickedRef.current = index;
  }, [frames, onSelectFrame, onSelectRange]);

  const formatTimestamp = (ts: number) => {
    const mins = Math.floor(ts / 60);
    const secs = Math.floor(ts % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="frame-browser">
      <div className="frame-browser-toolbar">
        <div className="frame-browser-info">
          <span className="small">{frames.length} frames</span>
          <span className="small">{selectedCount} selected</span>
        </div>
        <div className="frame-browser-controls">
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Every
            <input
              type="number"
              min={2}
              max={frames.length}
              value={nthValue}
              onChange={(e) => setNthValue(parseInt(e.target.value) || 2)}
              style={{ width: 48, padding: '2px 4px', fontSize: 11 }}
            />
            <button className="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onSelectEveryNth(nthValue)}>
              Nth
            </button>
          </label>
          <button className="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={onSelectAll}>
            All
          </button>
          <button className="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onSelectRange([])}>
            None
          </button>
          <div className="turn-toggle" style={{ marginLeft: 8 }}>
            <button
              className={`turn-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={`turn-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              Timeline
            </button>
          </div>
          {viewMode === 'grid' && (
            <input
              type="range"
              min={3}
              max={12}
              value={columns}
              onChange={(e) => setColumns(parseInt(e.target.value))}
              style={{ width: 60 }}
              title={`${columns} columns`}
            />
          )}
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div
          className="frame-browser-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {frames.map((frame, i) => (
            <div
              key={frame.id}
              className={`frame-thumb ${selectedIds.has(frame.id) ? 'selected' : ''}`}
              onClick={(e) => handleFrameClick(frame, i, e)}
            >
              <img src={frame.url} alt={`Frame ${frame.frameIndex}`} loading="lazy" />
              <span className="frame-thumb-label">{formatTimestamp(frame.timestamp)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="frame-browser-timeline" ref={timelineRef}>
          {frames.map((frame, i) => (
            <div
              key={frame.id}
              className={`frame-timeline-item ${selectedIds.has(frame.id) ? 'selected' : ''}`}
              onClick={(e) => handleFrameClick(frame, i, e)}
            >
              <img src={frame.url} alt={`Frame ${frame.frameIndex}`} loading="lazy" />
              <span className="frame-timeline-ts">{formatTimestamp(frame.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
