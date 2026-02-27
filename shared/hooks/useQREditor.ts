import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type QRContentType,
  type QRErrorCorrection,
  type QRLogoConfig,
  type QRProject,
  type QRStyle,
  type QRBatchConfig,
  defaultQRProject,
  buildDataString,
} from '@shared/lib/qr-types';
import { encodeQR, getQRVersion, type QRMatrix } from '@shared/lib/qr-encoder';

const MAX_UNDO = 50;

export function useQREditor() {
  const [project, setProject] = useState<QRProject>(defaultQRProject);
  const [undoStack, setUndoStack] = useState<QRProject[]>([]);
  const [redoStack, setRedoStack] = useState<QRProject[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pushUndo = useCallback((current: QRProject) => {
    setUndoStack(prev => {
      const next = [...prev, structuredClone(current)];
      if (next.length > MAX_UNDO) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setRedoStack(r => [...r, structuredClone(project)]);
      setProject(last);
      return next;
    });
  }, [project]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setUndoStack(u => [...u, structuredClone(project)]);
      setProject(last);
      return next;
    });
  }, [project]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // --- Setters (each pushes undo) ---

  const setContentType = useCallback((contentType: QRContentType) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, contentType, content: {} }));
  }, [project, pushUndo]);

  const setContent = useCallback((content: Record<string, string>) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, content }));
  }, [project, pushUndo]);

  const loadPreset = useCallback((contentType: QRContentType, content: Record<string, string>) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, contentType, content }));
  }, [project, pushUndo]);

  const updateContentField = useCallback((key: string, value: string) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, content: { ...prev.content, [key]: value } }));
  }, [project, pushUndo]);

  const setStyle = useCallback((style: Partial<QRStyle>) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, style: { ...prev.style, ...style } }));
  }, [project, pushUndo]);

  const setLogo = useCallback((logo: QRLogoConfig | null) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, logo }));
  }, [project, pushUndo]);

  const updateLogo = useCallback((update: Partial<QRLogoConfig>) => {
    pushUndo(project);
    setProject(prev => ({
      ...prev,
      logo: prev.logo ? { ...prev.logo, ...update } : null,
    }));
  }, [project, pushUndo]);

  const setSize = useCallback((size: number) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, size }));
  }, [project, pushUndo]);

  const setMargin = useCallback((margin: number) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, margin }));
  }, [project, pushUndo]);

  const setErrorCorrection = useCallback((errorCorrection: QRErrorCorrection) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, errorCorrection }));
  }, [project, pushUndo]);

  const setBatch = useCallback((batch: Partial<QRBatchConfig>) => {
    pushUndo(project);
    setProject(prev => ({ ...prev, batch: { ...prev.batch, ...batch } }));
  }, [project, pushUndo]);

  // --- Derived values ---

  const dataString = useMemo(
    () => buildDataString(project.contentType, project.content),
    [project.contentType, project.content],
  );

  const { matrix, version } = useMemo(
    () => encodeQR(dataString, project.errorCorrection),
    [dataString, project.errorCorrection],
  );

  // --- Batch data strings ---

  const batchDataStrings = useMemo((): string[] => {
    if (!project.batch.enabled) return [];
    if (project.batch.mode === 'csv') {
      return project.batch.csvRows.filter(Boolean);
    }
    const items: string[] = [];
    for (let i = project.batch.start; i <= project.batch.end; i++) {
      const num = String(i).padStart(3, '0');
      items.push(`${project.batch.prefix}${num}`);
    }
    return items;
  }, [project.batch]);

  // --- Rendering ---

  const renderToCanvas = useCallback((canvas: HTMLCanvasElement, mat?: QRMatrix, outputSize?: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const m = mat || matrix;
    const sz = outputSize || project.size;
    const modules = m.length;
    const totalModules = modules + project.margin * 2;
    const cellSize = sz / totalModules;

    canvas.width = sz;
    canvas.height = sz;
    ctx.clearRect(0, 0, sz, sz);

    // Background
    if (project.style.background !== 'transparent') {
      ctx.fillStyle = project.style.background;
      ctx.fillRect(0, 0, sz, sz);
    }

    ctx.fillStyle = project.style.foreground;
    const marginPx = project.margin * cellSize;

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (!m[r][c]) continue;
        const x = marginPx + c * cellSize;
        const y = marginPx + r * cellSize;

        // Check if this is a finder pattern module
        const isFinder = isFinderModule(r, c, modules);

        if (isFinder) {
          drawFinderModule(ctx, x, y, cellSize, project.style.finderStyle);
        } else {
          drawModule(ctx, x, y, cellSize, project.style.moduleStyle);
        }
      }
    }

    // Logo overlay
    if (project.logo) {
      drawLogo(ctx, project.logo, sz);
    }
  }, [matrix, project]);

  // --- Export ---

  const exportPng = useCallback(async (): Promise<Blob | null> => {
    const offscreen = document.createElement('canvas');
    renderToCanvas(offscreen);
    return new Promise(resolve => {
      offscreen.toBlob(blob => resolve(blob), 'image/png');
    });
  }, [renderToCanvas]);

  const exportSvg = useCallback((): string => {
    const modules = matrix.length;
    const totalModules = modules + project.margin * 2;
    const cellSize = project.size / totalModules;
    const marginPx = project.margin * cellSize;

    const parts: string[] = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${project.size} ${project.size}" width="${project.size}" height="${project.size}">`);

    if (project.style.background !== 'transparent') {
      parts.push(`<rect width="${project.size}" height="${project.size}" fill="${project.style.background}" />`);
    }

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (!matrix[r][c]) continue;
        const x = marginPx + c * cellSize;
        const y = marginPx + r * cellSize;
        const s = project.style.moduleStyle;
        const radius = s === 'rounded' ? cellSize * 0.3 : 0;

        if (s === 'dots') {
          parts.push(`<circle cx="${x + cellSize / 2}" cy="${y + cellSize / 2}" r="${cellSize * 0.4}" fill="${project.style.foreground}" />`);
        } else if (s === 'diamond') {
          const cx = x + cellSize / 2;
          const cy = y + cellSize / 2;
          const h = cellSize * 0.45;
          parts.push(`<polygon points="${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}" fill="${project.style.foreground}" />`);
        } else {
          parts.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${radius}" fill="${project.style.foreground}" />`);
        }
      }
    }

    parts.push('</svg>');
    return parts.join('\n');
  }, [matrix, project]);

  const exportBatchPng = useCallback(async (): Promise<Blob[]> => {
    const blobs: Blob[] = [];
    for (const data of batchDataStrings) {
      const { matrix: batchMatrix } = encodeQR(data, project.errorCorrection);
      const offscreen = document.createElement('canvas');
      renderToCanvas(offscreen, batchMatrix);
      const blob = await new Promise<Blob | null>(resolve => {
        offscreen.toBlob(b => resolve(b), 'image/png');
      });
      if (blob) blobs.push(blob);
    }
    return blobs;
  }, [batchDataStrings, project.errorCorrection, renderToCanvas]);

  const copyToClipboard = useCallback(async () => {
    const blob = await exportPng();
    if (blob) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }
  }, [exportPng]);

  return {
    project,
    setContentType,
    setContent,
    loadPreset,
    updateContentField,
    setStyle,
    setLogo,
    updateLogo,
    setSize,
    setMargin,
    setErrorCorrection,
    setBatch,
    canUndo,
    canRedo,
    undo,
    redo,
    dataString,
    matrix,
    version,
    batchDataStrings,
    renderToCanvas,
    exportPng,
    exportSvg,
    exportBatchPng,
    copyToClipboard,
    canvasRef,
  };
}

// --- Drawing helpers -------------------------------------------------------

function isFinderModule(r: number, c: number, size: number): boolean {
  // Top-left
  if (r < 7 && c < 7) return true;
  // Top-right
  if (r < 7 && c >= size - 7) return true;
  // Bottom-left
  if (r >= size - 7 && c < 7) return true;
  return false;
}

function drawModule(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, style: string) {
  switch (style) {
    case 'rounded':
      roundedRect(ctx, x, y, size, size, size * 0.3);
      ctx.fill();
      break;
    case 'dots':
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diamond': {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const h = size * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h);
      ctx.lineTo(cx + h, cy);
      ctx.lineTo(cx, cy + h);
      ctx.lineTo(cx - h, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      ctx.fillRect(x, y, size, size);
  }
}

function drawFinderModule(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, style: string) {
  switch (style) {
    case 'rounded':
      roundedRect(ctx, x, y, size, size, size * 0.35);
      ctx.fill();
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.48, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      ctx.fillRect(x, y, size, size);
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLogo(ctx: CanvasRenderingContext2D, logo: QRLogoConfig, canvasSize: number) {
  const logoSize = canvasSize * logo.size;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const padding = logoSize * 0.15;

  // Draw pad
  ctx.fillStyle = logo.padColor;
  if (logo.padShape === 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, logoSize / 2 + padding, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const offset = logoSize / 2 + padding;
    ctx.fillRect(cx - offset, cy - offset, offset * 2, offset * 2);
  }

  // Draw logo image
  const img = new Image();
  img.src = logo.src;
  if (img.complete) {
    ctx.drawImage(img, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
  }
}
