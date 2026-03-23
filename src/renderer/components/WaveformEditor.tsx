import React, { useCallback, useEffect, useRef, useState } from 'react';
import { mediaStreamUrl } from '../lib/image-utils';
import type { AudioSegment } from '../lib/types';

type Props = {
  filePath: string;
  duration: number;
  peaks: number[];
  segments: AudioSegment[];
  onSegmentsChange: (segments: AudioSegment[]) => void;
  parentId: string;
};

const COLORS = [
  'rgba(255, 45, 120, 0.3)',
  'rgba(100, 149, 237, 0.3)',
  'rgba(50, 205, 50, 0.3)',
  'rgba(255, 165, 0, 0.3)',
  'rgba(148, 103, 189, 0.3)',
  'rgba(255, 99, 71, 0.3)'
];

export default function WaveformEditor({ filePath, duration, peaks, segments, onSegmentsChange, parentId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragging, setDragging] = useState<{ segIndex: number; handle: 'start' | 'end' } | null>(null);
  const [creating, setCreating] = useState<{ startX: number; startTime: number } | null>(null);
  const [intervalSecs, setIntervalSecs] = useState(10);
  const animFrameRef = useRef<number>(0);

  const timeToX = useCallback((time: number, width: number) => (time / duration) * width, [duration]);
  const xToTime = useCallback((x: number, width: number) => Math.max(0, Math.min(duration, (x / width) * duration)), [duration]);

  // Draw waveform + segments + cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const midY = h / 2;

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Draw segments
    segments.forEach((seg, i) => {
      const x1 = timeToX(seg.startTime, w);
      const x2 = timeToX(seg.endTime, w);
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fillRect(x1, 0, x2 - x1, h);

      // Segment label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px "Space Grotesk", sans-serif';
      ctx.fillText(seg.label, x1 + 4, 14);

      // Handles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(x1 - 1, 0, 3, h);
      ctx.fillRect(x2 - 1, 0, 3, h);
    });

    // Draw waveform
    const barWidth = w / peaks.length;
    ctx.fillStyle = '#ff2d78';
    for (let i = 0; i < peaks.length; i++) {
      const barHeight = peaks[i] * midY * 0.9;
      const x = i * barWidth;
      ctx.fillRect(x, midY - barHeight, Math.max(1, barWidth - 0.5), barHeight * 2);
    }

    // Playback cursor
    const cursorX = timeToX(playbackTime, w);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, h);
    ctx.stroke();

    // Time markers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '9px "IBM Plex Mono", monospace';
    const step = duration > 120 ? 30 : duration > 30 ? 10 : 5;
    for (let t = 0; t <= duration; t += step) {
      const x = timeToX(t, w);
      ctx.fillRect(x, h - 12, 1, 12);
      const label = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
      ctx.fillText(label, x + 3, h - 2);
    }
  }, [peaks, segments, playbackTime, duration, timeToX]);

  // Playback tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const update = () => {
      setPlaybackTime(audio.currentTime);
      if (!audio.paused) {
        animFrameRef.current = requestAnimationFrame(update);
      }
    };

    const onPlay = () => { setIsPlaying(true); update(); };
    const onPause = () => { setIsPlaying(false); cancelAnimationFrame(animFrameRef.current); };
    const onEnded = () => { setIsPlaying(false); cancelAnimationFrame(animFrameRef.current); };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const time = xToTime(x, w);

    // Check if clicking near a segment handle
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const startX = timeToX(seg.startTime, w);
      const endX = timeToX(seg.endTime, w);

      if (Math.abs(x - startX) < 6) {
        setDragging({ segIndex: i, handle: 'start' });
        return;
      }
      if (Math.abs(x - endX) < 6) {
        setDragging({ segIndex: i, handle: 'end' });
        return;
      }
    }

    // Start creating a new segment
    setCreating({ startX: x, startTime: time });
  }, [segments, xToTime, timeToX]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const time = xToTime(x, w);

    if (dragging) {
      const updated = [...segments];
      const seg = { ...updated[dragging.segIndex] };
      if (dragging.handle === 'start') {
        seg.startTime = Math.min(time, seg.endTime - 0.1);
      } else {
        seg.endTime = Math.max(time, seg.startTime + 0.1);
      }
      seg.duration = seg.endTime - seg.startTime;
      updated[dragging.segIndex] = seg;
      onSegmentsChange(updated);
    }
  }, [dragging, segments, onSegmentsChange, xToTime]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      setDragging(null);
      return;
    }

    if (creating) {
      const canvas = canvasRef.current;
      if (!canvas) { setCreating(null); return; }
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const endTime = xToTime(x, rect.width);

      const start = Math.min(creating.startTime, endTime);
      const end = Math.max(creating.startTime, endTime);

      if (end - start >= 0.5) {
        // Create new segment
        const newSeg: AudioSegment = {
          id: `${parentId}-seg-${segments.length}`,
          parentId,
          segmentIndex: segments.length,
          startTime: start,
          endTime: end,
          duration: end - start,
          path: '',
          label: `Segment ${segments.length + 1}`
        };
        onSegmentsChange([...segments, newSeg]);
      } else {
        // Click to seek
        if (audioRef.current) {
          audioRef.current.currentTime = creating.startTime;
          setPlaybackTime(creating.startTime);
        }
      }
      setCreating(null);
    }
  }, [creating, dragging, segments, onSegmentsChange, parentId, xToTime]);

  const handleAutoSegment = () => {
    const newSegs: AudioSegment[] = [];
    for (let t = 0; t < duration; t += intervalSecs) {
      const end = Math.min(t + intervalSecs, duration);
      newSegs.push({
        id: `${parentId}-seg-${newSegs.length}`,
        parentId,
        segmentIndex: newSegs.length,
        startTime: t,
        endTime: end,
        duration: end - t,
        path: '',
        label: `Segment ${newSegs.length + 1}`
      });
    }
    onSegmentsChange(newSegs);
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  };

  const handlePlaySegment = (seg: AudioSegment) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seg.startTime;
    audio.play();
    // Stop at segment end
    const checkEnd = () => {
      if (audio.currentTime >= seg.endTime) {
        audio.pause();
        audio.removeEventListener('timeupdate', checkEnd);
      }
    };
    audio.addEventListener('timeupdate', checkEnd);
  };

  const removeSegment = (index: number) => {
    const updated = segments.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      segmentIndex: i,
      id: `${parentId}-seg-${i}`,
      label: s.label.startsWith('Segment') ? `Segment ${i + 1}` : s.label
    }));
    onSegmentsChange(updated);
  };

  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="waveform-editor" ref={containerRef}>
      <audio ref={audioRef} src={mediaStreamUrl(filePath)} preload="auto" />

      <div className="waveform-toolbar">
        <button className="secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={handlePlayPause}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="small">{formatTime(playbackTime)} / {formatTime(duration)}</span>
        <div style={{ flex: 1 }} />
        <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Every
          <input
            type="number"
            min={1}
            max={300}
            value={intervalSecs}
            onChange={(e) => setIntervalSecs(parseInt(e.target.value) || 10)}
            style={{ width: 48, padding: '2px 4px', fontSize: 11 }}
          />
          s
          <button className="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={handleAutoSegment}>
            Auto-Segment
          </button>
        </label>
        <button className="ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onSegmentsChange([])}>
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(null); setCreating(null); }}
      />

      <div className="waveform-hint small">
        Click and drag to create segments. Drag segment edges to adjust.
      </div>

      {segments.length > 0 && (
        <div className="waveform-segments-list">
          {segments.map((seg, i) => (
            <div key={seg.id} className="waveform-segment-item">
              <span
                className="waveform-segment-color"
                style={{ background: COLORS[i % COLORS.length].replace('0.3', '0.8') }}
              />
              <span className="small" style={{ flex: 1 }}>{seg.label}</span>
              <span className="small" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {formatTime(seg.startTime)} - {formatTime(seg.endTime)} ({formatTime(seg.duration)})
              </span>
              <button
                className="ghost"
                style={{ padding: '2px 6px', fontSize: 10 }}
                onClick={() => handlePlaySegment(seg)}
              >
                Play
              </button>
              <button
                className="ghost"
                style={{ padding: '2px 6px', fontSize: 10, color: 'var(--danger)' }}
                onClick={() => removeSegment(i)}
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
