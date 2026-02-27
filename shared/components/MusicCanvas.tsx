import React, { useCallback, useEffect, useRef, useState } from 'react';
import { hitTest, renderScoreToSvg } from '@shared/lib/music-renderer';
import type { MusicScore, MusicTool, NoteDuration, Pitch } from '@shared/lib/music-types';

type Props = {
  score: MusicScore;
  selectedStaffId: string | null;
  selectedMeasureIdx: number | null;
  selectedNoteIdx: number | null;
  currentTool: MusicTool;
  currentDuration: NoteDuration;
  dotted: boolean;
  onAddNote: (staffId: string, measureIdx: number, pitch: Pitch) => void;
  onSelectNote: (staffId: string | null, measureIdx: number | null, noteIdx: number | null) => void;
  onRemoveNote: (staffId: string, measureIdx: number, noteIdx: number) => void;
  renderToCanvas: (canvas: HTMLCanvasElement) => void;
};

export default function MusicCanvas({
  score, selectedStaffId, selectedMeasureIdx, selectedNoteIdx,
  currentTool, currentDuration, dotted,
  onAddNote, onSelectNote, onRemoveNote, renderToCanvas
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Generate SVG string for display
  const svgStr = renderScoreToSvg(score, {
    selectedStaffId,
    selectedMeasureIdx,
    selectedNoteIdx,
  });

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Get click position relative to the SVG content
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const scaleX = score.width / rect.width;
    const scaleY = score.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const hit = hitTest(score, px, py);
    if (!hit) {
      onSelectNote(null, null, null);
      return;
    }

    if (currentTool === 'note') {
      onAddNote(hit.staffId, hit.measureIdx, hit.pitch);
    } else if (currentTool === 'eraser') {
      // Find closest note in the measure to remove
      const staff = score.staves.find((s) => s.id === hit.staffId);
      if (staff) {
        const measure = staff.measures[hit.measureIdx];
        if (measure && measure.notes.length > 0) {
          // Remove the last note in the measure (simple eraser behavior)
          onRemoveNote(hit.staffId, hit.measureIdx, measure.notes.length - 1);
        }
      }
    } else if (currentTool === 'select') {
      // Find which note was clicked (simple: select by measure)
      const staff = score.staves.find((s) => s.id === hit.staffId);
      if (staff) {
        const measure = staff.measures[hit.measureIdx];
        if (measure && measure.notes.length > 0) {
          onSelectNote(hit.staffId, hit.measureIdx, measure.notes.length - 1);
        } else {
          onSelectNote(hit.staffId, hit.measureIdx, null);
        }
      }
    }
  }, [score, currentTool, onAddNote, onSelectNote, onRemoveNote]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.max(0.25, Math.min(5, prev * delta)));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, []);

  // Pan with middle-click or alt+drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panOrigin.current.x + (e.clientX - panStart.current.x),
      y: panOrigin.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(5, z * 1.25)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.25, z * 0.8)), []);

  // Scale SVG to fit container
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a1a',
  };

  const svgWrapStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: currentTool === 'note' ? 'crosshair' : currentTool === 'eraser' ? 'not-allowed' : 'default',
  };

  const svgInnerStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'center center',
    maxWidth: '100%',
    maxHeight: '100%',
  };

  return (
    <div className="mint-canvas-container" ref={containerRef} style={containerStyle}>
      <div
        style={svgWrapStyle}
        onClick={handleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          style={svgInnerStyle}
          dangerouslySetInnerHTML={{ __html: svgStr }}
        />
      </div>
      <div className="mint-canvas-info">
        <span className="small">{score.staves.length} {score.staves.length === 1 ? 'staff' : 'staves'} · {score.staves[0]?.measures.length || 0} measures</span>
        <div className="mint-zoom-controls">
          <button className="mint-zoom-btn" onClick={zoomOut} title="Zoom out">-</button>
          <button className="mint-zoom-btn" onClick={resetView} title="Reset view">{Math.round(zoom * 100)}%</button>
          <button className="mint-zoom-btn" onClick={zoomIn} title="Zoom in">+</button>
        </div>
        <span className="small">{score.keySignature} · {score.timeSignature.beats}/{score.timeSignature.beatType} · {score.tempo} BPM</span>
      </div>
    </div>
  );
}
