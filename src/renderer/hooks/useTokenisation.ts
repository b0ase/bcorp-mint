import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppMode, AudioSegment, ExtractedFrame } from '@shared/lib/types';

type ExtractionProgress = { completed: number; total: number; stage: string };

export function useTokenisation() {
  const [mode, setMode] = useState<AppMode>('stamp');
  const [extractedFrames, setExtractedFrames] = useState<Map<string, ExtractedFrame[]>>(new Map());
  const [audioSegments, setAudioSegments] = useState<Map<string, AudioSegment[]>>(new Map());
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set());
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
  const [mintingProgress, setMintingProgress] = useState<{ completed: number; total: number } | null>(null);

  // Track temp directories for cleanup
  const tempDirs = useRef<Set<string>>(new Set());

  // Listen for extraction progress
  useEffect(() => {
    const cleanup = window.mint.onExtractionProgress((data) => {
      setExtractionProgress(data);
    });
    return cleanup;
  }, []);

  const extractFrames = useCallback(async (
    sourceId: string,
    filePath: string,
    options: { interval?: number; maxFrames?: number; quality?: 'low' | 'medium' | 'high' } = {}
  ) => {
    setExtractionProgress({ completed: 0, total: options.maxFrames ?? 500, stage: 'Starting...' });

    const result = await window.mint.extractVideoFrames({
      filePath,
      interval: options.interval ?? 1,
      maxFrames: options.maxFrames ?? 500,
      quality: options.quality ?? 'medium'
    });

    tempDirs.current.add(result.outputDir);

    // Load frame thumbnails as data URLs
    const frames: ExtractedFrame[] = await Promise.all(
      result.frames.map(async (f) => {
        const url = await window.mint.fileUrl(f.path);
        return {
          id: `${sourceId}-frame-${f.index}`,
          parentId: sourceId,
          frameIndex: f.index,
          timestamp: f.timestamp,
          path: f.path,
          url,
          width: 0,
          height: 0
        };
      })
    );

    setExtractedFrames((prev) => new Map(prev).set(sourceId, frames));
    setExtractionProgress(null);
    return frames;
  }, []);

  const addAudioSegments = useCallback((sourceId: string, segments: AudioSegment[]) => {
    setAudioSegments((prev) => new Map(prev).set(sourceId, segments));
  }, []);

  const selectPiece = useCallback((id: string, multi?: boolean) => {
    setSelectedPieceIds((prev) => {
      const next = new Set(multi ? prev : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectPieceRange = useCallback((ids: string[]) => {
    setSelectedPieceIds(new Set(ids));
  }, []);

  const selectAllPieces = useCallback((sourceId: string) => {
    const frames = extractedFrames.get(sourceId);
    const segs = audioSegments.get(sourceId);
    const ids: string[] = [];
    if (frames) ids.push(...frames.map((f) => f.id));
    if (segs) ids.push(...segs.map((s) => s.id));
    setSelectedPieceIds(new Set(ids));
  }, [extractedFrames, audioSegments]);

  const selectEveryNth = useCallback((sourceId: string, n: number) => {
    const frames = extractedFrames.get(sourceId);
    if (!frames) return;
    const ids = frames.filter((_, i) => i % n === 0).map((f) => f.id);
    setSelectedPieceIds(new Set(ids));
  }, [extractedFrames]);

  const clearFrames = useCallback(async (sourceId: string) => {
    const frames = extractedFrames.get(sourceId);
    if (frames && frames.length > 0) {
      // Cleanup temp directory
      const frameDir = frames[0].path.split('/').slice(0, -1).join('/');
      if (frameDir) {
        await window.mint.cleanupExtraction(frameDir);
        tempDirs.current.delete(frameDir);
      }
    }
    setExtractedFrames((prev) => {
      const next = new Map(prev);
      next.delete(sourceId);
      return next;
    });
    setSelectedPieceIds(new Set());
  }, [extractedFrames]);

  const clearSegments = useCallback((sourceId: string) => {
    setAudioSegments((prev) => {
      const next = new Map(prev);
      next.delete(sourceId);
      return next;
    });
    setSelectedPieceIds(new Set());
  }, []);

  // Cleanup all temp dirs on unmount
  useEffect(() => {
    return () => {
      for (const dir of tempDirs.current) {
        window.mint.cleanupExtraction(dir).catch(() => {});
      }
    };
  }, []);

  return {
    mode,
    setMode,
    extractedFrames,
    audioSegments,
    selectedPieceIds,
    extractionProgress,
    mintingProgress,
    setMintingProgress,
    extractFrames,
    addAudioSegments,
    selectPiece,
    selectPieceRange,
    selectAllPieces,
    selectEveryNth,
    clearFrames,
    clearSegments
  };
}
