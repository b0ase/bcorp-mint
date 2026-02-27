import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { QRProject } from '@shared/lib/qr-types';
import type { QRMatrix } from '@shared/lib/qr-encoder';

type Props = {
  project: QRProject;
  matrix: QRMatrix;
  version: number;
  dataString: string;
  renderToCanvas: (canvas: HTMLCanvasElement, mat?: QRMatrix, outputSize?: number) => void;
};

export default function QRCanvas({ project, matrix, version, dataString, renderToCanvas }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Render QR to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderToCanvas(canvas);
  }, [renderToCanvas]);

  // Zoom via wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.25, Math.min(4, prev * delta)));
  }, []);

  // Pan via pointer
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Reset view
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const modules = matrix.length;
  const ecLabels: Record<string, string> = { L: '7%', M: '15%', Q: '25%', H: '30%' };

  return (
    <div className="qr-canvas-wrapper">
      <div
        ref={containerRef}
        className="qr-canvas-viewport"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="qr-canvas-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <canvas ref={canvasRef} className="qr-canvas" />
        </div>
      </div>

      <div className="qr-info-bar">
        <span>{dataString.length} chars</span>
        <span>V{version} ({modules}&times;{modules})</span>
        <span>EC: {project.errorCorrection} ({ecLabels[project.errorCorrection]})</span>
        <span>{project.size}px</span>
        <button className="ghost qr-reset-btn" onClick={handleReset} title="Reset zoom &amp; pan">
          1:1
        </button>
      </div>
    </div>
  );
}
