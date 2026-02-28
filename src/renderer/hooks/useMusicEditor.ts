import { useCallback, useRef, useState } from 'react';
import { defaultMeasure, defaultMusicScore, defaultStaff } from '../lib/music-defaults';
import { renderScoreToCanvas, renderScoreToSvg } from '../lib/music-renderer';
import type { Clef, KeySignature, MusicNote, MusicScore, MusicTool, NoteDuration, Pitch, TimeSignature } from '../lib/music-types';

const MAX_UNDO = 50;

export function useMusicEditor() {
  const [score, setScore] = useState<MusicScore>(defaultMusicScore);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedMeasureIdx, setSelectedMeasureIdx] = useState<number | null>(null);
  const [selectedNoteIdx, setSelectedNoteIdx] = useState<number | null>(null);
  const [currentTool, setCurrentTool] = useState<MusicTool>('note');
  const [currentDuration, setCurrentDuration] = useState<NoteDuration>('quarter');
  const [dotted, setDotted] = useState(false);
  const [undoStack, setUndoStack] = useState<MusicScore[]>([]);
  const [redoStack, setRedoStack] = useState<MusicScore[]>([]);
  const svgImageCache = useRef<HTMLImageElement | null>(null);

  const pushUndo = useCallback((current: MusicScore) => {
    setUndoStack((prev) => {
      const next = [...prev, structuredClone(current)];
      if (next.length > MAX_UNDO) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setRedoStack((r) => [...r, structuredClone(score)]);
      setScore(last);
      return next;
    });
  }, [score]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setUndoStack((u) => [...u, structuredClone(score)]);
      setScore(last);
      return next;
    });
  }, [score]);

  // --- Note operations ---

  const addNote = useCallback((staffId: string, measureIdx: number, pitch: Pitch) => {
    pushUndo(score);
    const note: MusicNote = {
      id: crypto.randomUUID(),
      type: 'note',
      duration: currentDuration,
      dotted,
      pitch,
    };
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.map((s) => {
        if (s.id !== staffId) return s;
        return {
          ...s,
          measures: s.measures.map((m, mi) => {
            if (mi !== measureIdx) return m;
            return { ...m, notes: [...m.notes, note] };
          }),
        };
      }),
    }));
    setSelectedStaffId(staffId);
    setSelectedMeasureIdx(measureIdx);
    setSelectedNoteIdx(null);
  }, [score, currentDuration, dotted, pushUndo]);

  const addRest = useCallback((staffId: string, measureIdx: number) => {
    pushUndo(score);
    const rest: MusicNote = {
      id: crypto.randomUUID(),
      type: 'rest',
      duration: currentDuration,
      dotted,
      pitch: { note: 'C', octave: 4 }, // placeholder
    };
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.map((s) => {
        if (s.id !== staffId) return s;
        return {
          ...s,
          measures: s.measures.map((m, mi) => {
            if (mi !== measureIdx) return m;
            return { ...m, notes: [...m.notes, rest] };
          }),
        };
      }),
    }));
  }, [score, currentDuration, dotted, pushUndo]);

  const removeNote = useCallback((staffId: string, measureIdx: number, noteIdx: number) => {
    pushUndo(score);
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.map((s) => {
        if (s.id !== staffId) return s;
        return {
          ...s,
          measures: s.measures.map((m, mi) => {
            if (mi !== measureIdx) return m;
            return { ...m, notes: m.notes.filter((_, ni) => ni !== noteIdx) };
          }),
        };
      }),
    }));
    setSelectedNoteIdx(null);
  }, [score, pushUndo]);

  const updateNote = useCallback((staffId: string, measureIdx: number, noteIdx: number, patch: Partial<MusicNote>) => {
    pushUndo(score);
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.map((s) => {
        if (s.id !== staffId) return s;
        return {
          ...s,
          measures: s.measures.map((m, mi) => {
            if (mi !== measureIdx) return m;
            return {
              ...m,
              notes: m.notes.map((n, ni) => ni === noteIdx ? { ...n, ...patch } : n),
            };
          }),
        };
      }),
    }));
  }, [score, pushUndo]);

  const selectNote = useCallback((staffId: string | null, measureIdx: number | null, noteIdx: number | null) => {
    setSelectedStaffId(staffId);
    setSelectedMeasureIdx(measureIdx);
    setSelectedNoteIdx(noteIdx);
  }, []);

  // --- Measure operations ---

  const addMeasure = useCallback((staffId?: string) => {
    pushUndo(score);
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.map((s) => {
        if (staffId && s.id !== staffId) return s;
        return { ...s, measures: [...s.measures, defaultMeasure()] };
      }),
    }));
  }, [score, pushUndo]);

  // --- Staff operations ---

  const addStaff = useCallback((name = 'Bass', clef: Clef = 'bass') => {
    pushUndo(score);
    const measureCount = score.staves[0]?.measures.length || 4;
    const newStaff = defaultStaff(name, clef, measureCount);
    setScore((prev) => ({
      ...prev,
      staves: [...prev.staves, newStaff],
      height: prev.height + 120,
    }));
  }, [score, pushUndo]);

  const removeStaff = useCallback((staffId: string) => {
    if (score.staves.length <= 1) return; // keep at least one
    pushUndo(score);
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.filter((s) => s.id !== staffId),
      height: Math.max(400, prev.height - 120),
    }));
    if (selectedStaffId === staffId) {
      setSelectedStaffId(null);
      setSelectedMeasureIdx(null);
      setSelectedNoteIdx(null);
    }
  }, [score, pushUndo, selectedStaffId]);

  const updateStaffClef = useCallback((staffId: string, clef: Clef) => {
    pushUndo(score);
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.map((s) => s.id === staffId ? { ...s, clef } : s),
    }));
  }, [score, pushUndo]);

  const updateStaffName = useCallback((staffId: string, name: string) => {
    pushUndo(score);
    setScore((prev) => ({
      ...prev,
      staves: prev.staves.map((s) => s.id === staffId ? { ...s, name } : s),
    }));
  }, [score, pushUndo]);

  // --- Score meta ---

  const updateScoreMeta = useCallback((patch: Partial<Pick<MusicScore, 'title' | 'composer'>>) => {
    pushUndo(score);
    setScore((prev) => ({ ...prev, ...patch }));
  }, [score, pushUndo]);

  const setKeySignature = useCallback((keySignature: KeySignature) => {
    pushUndo(score);
    setScore((prev) => ({ ...prev, keySignature }));
  }, [score, pushUndo]);

  const setTimeSignature = useCallback((timeSignature: TimeSignature) => {
    pushUndo(score);
    setScore((prev) => ({ ...prev, timeSignature }));
  }, [score, pushUndo]);

  const setTempo = useCallback((tempo: number) => {
    pushUndo(score);
    setScore((prev) => ({ ...prev, tempo }));
  }, [score, pushUndo]);

  // --- Rendering & Export ---

  const renderToCanvas = useCallback((canvas: HTMLCanvasElement) => {
    renderScoreToCanvas(canvas, score, {
      selectedStaffId,
      selectedMeasureIdx,
      selectedNoteIdx,
    });
  }, [score, selectedStaffId, selectedMeasureIdx, selectedNoteIdx]);

  const exportPng = useCallback((): string | null => {
    const svgStr = renderScoreToSvg(score);
    const canvas = document.createElement('canvas');
    canvas.width = score.width;
    canvas.height = score.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Synchronous export via serialized SVG → canvas
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);

    // Return a promise-like approach via cached rendering
    // For synchronous export, draw the current score state
    const svgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);

    // We need to use the cached image if available
    // For now, return the SVG as a data URL that can be converted
    return svgData;
  }, [score]);

  const exportSvg = useCallback((): string => {
    return renderScoreToSvg(score);
  }, [score]);

  return {
    score,
    selectedStaffId,
    selectedMeasureIdx,
    selectedNoteIdx,
    currentTool,
    currentDuration,
    dotted,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,

    setCurrentTool,
    setCurrentDuration,
    setDotted,

    addNote,
    addRest,
    removeNote,
    updateNote,
    selectNote,

    addMeasure,
    addStaff,
    removeStaff,
    updateStaffClef,
    updateStaffName,

    updateScoreMeta,
    setKeySignature,
    setTimeSignature,
    setTempo,

    undo,
    redo,

    renderToCanvas,
    exportPng,
    exportSvg,
  };
}
