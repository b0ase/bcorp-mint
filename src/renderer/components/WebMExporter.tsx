import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { ImageItem } from '../lib/types';
import { mediaStreamUrl } from '../lib/image-utils';

type Props = {
  videos: ImageItem[];
  selectedVideo: ImageItem | null;
  onSelectVideo: (id: string) => void;
};

export default function WebMExporter({ videos, selectedVideo, onSelectVideo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Crop region (normalized 0-1)
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const cropRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  cropRef.current = crop;
  const [draggingCrop, setDraggingCrop] = useState<string | null>(null);
  const dragStartRef = useRef({ mx: 0, my: 0, crop: { x: 0, y: 0, w: 1, h: 1 } });

  // Output settings
  const [outputWidth, setOutputWidth] = useState(1280);
  const [outputHeight, setOutputHeight] = useState(720);
  const outputRef = useRef({ w: 1280, h: 720 });
  outputRef.current = { w: outputWidth, h: outputHeight };
  const [bitrate, setBitrate] = useState(5);
  const [preset, setPreset] = useState<'landscape' | 'portrait' | 'square' | 'custom'>('landscape');

  const videoItems = videos.filter(v => v.mediaType === 'video');

  // Load video
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !selectedVideo) return;
    vid.src = mediaStreamUrl(selectedVideo.path);
    vid.load();
    vid.onloadedmetadata = () => {
      setDuration(vid.duration);
      setOutPoint(vid.duration);
      setInPoint(0);
      setCurrentTime(0);
    };
    vid.onloadeddata = () => { vid.currentTime = 0.1; };
  }, [selectedVideo]);

  // Time tracking
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => {
      setCurrentTime(vid.currentTime);
      if (!isExporting && vid.currentTime >= outPoint) {
        vid.pause();
        vid.currentTime = inPoint;
        setIsPlaying(false);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
    };
  }, [outPoint, inPoint, isExporting]);

  // Apply preset
  useEffect(() => {
    if (preset === 'landscape') { setOutputWidth(1280); setOutputHeight(720); setCrop({ x: 0, y: 0, w: 1, h: 1 }); }
    else if (preset === 'portrait') { setOutputWidth(720); setOutputHeight(1280); setCrop({ x: 0.2, y: 0, w: 0.6, h: 1 }); }
    else if (preset === 'square') { setOutputWidth(1080); setOutputHeight(1080); setCrop({ x: 0.15, y: 0, w: 0.7, h: 1 }); }
  }, [preset]);

  // Canvas render loop — always running, draws cropped video
  useEffect(() => {
    let running = true;
    const render = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) { animRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { animRef.current = requestAnimationFrame(render); return; }

      // Preview: always show full video. Crop only applies during export.
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, vw, vh);

      if (video.readyState >= 2 && video.videoWidth > 0) {
        ctx.drawImage(video, 0, 0, vw, vh);

        // Draw dim overlay outside crop region
        const c = cropRef.current;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        // Top
        ctx.fillRect(0, 0, vw, c.y * vh);
        // Bottom
        ctx.fillRect(0, (c.y + c.h) * vh, vw, vh - (c.y + c.h) * vh);
        // Left
        ctx.fillRect(0, c.y * vh, c.x * vw, c.h * vh);
        // Right
        ctx.fillRect((c.x + c.w) * vw, c.y * vh, vw - (c.x + c.w) * vw, c.h * vh);

        // Crop border
        ctx.strokeStyle = '#c9a84c';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(c.x * vw, c.y * vh, c.w * vw, c.h * vh);
        ctx.setLineDash([]);
      }

      animRef.current = requestAnimationFrame(render);
    };
    render();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, []);

  // Controls
  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      if (vid.currentTime < inPoint || vid.currentTime >= outPoint) vid.currentTime = inPoint;
      vid.play();
    } else vid.pause();
  };

  const seek = (time: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(duration, time));
  };

  // Crop drag
  const handleCropMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingCrop(handle);
    dragStartRef.current = { mx: e.clientX, my: e.clientY, crop: { ...crop } };
  }, [crop]);

  useEffect(() => {
    if (!draggingCrop) return;
    const onMove = (e: MouseEvent) => {
      const overlay = document.getElementById('crop-overlay');
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const dx = (e.clientX - dragStartRef.current.mx) / rect.width;
      const dy = (e.clientY - dragStartRef.current.my) / rect.height;
      const c = dragStartRef.current.crop;
      if (draggingCrop === 'move') {
        setCrop({ ...c, x: Math.max(0, Math.min(1 - c.w, c.x + dx)), y: Math.max(0, Math.min(1 - c.h, c.y + dy)) });
      } else if (draggingCrop === 'tl') {
        setCrop({ x: Math.max(0, c.x + dx), y: Math.max(0, c.y + dy), w: Math.max(0.1, c.w - dx), h: Math.max(0.1, c.h - dy) });
      } else if (draggingCrop === 'br') {
        setCrop({ ...c, w: Math.max(0.1, Math.min(1 - c.x, c.w + dx)), h: Math.max(0.1, Math.min(1 - c.y, c.h + dy)) });
      } else if (draggingCrop === 'tr') {
        setCrop({ ...c, y: Math.max(0, c.y + dy), w: Math.max(0.1, Math.min(1 - c.x, c.w + dx)), h: Math.max(0.1, c.h - dy) });
      } else if (draggingCrop === 'bl') {
        setCrop({ ...c, x: Math.max(0, c.x + dx), w: Math.max(0.1, c.w - dx), h: Math.max(0.1, Math.min(1 - c.y, c.h + dy)) });
      }
    };
    const onUp = () => setDraggingCrop(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [draggingCrop]);

  // Export — uses a separate offscreen canvas for cropped output
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportAnimRef = useRef<number>(0);

  const handleExport = async () => {
    const vid = videoRef.current;
    if (!vid) return;

    setIsExporting(true);
    setExportProgress(0);

    // Create offscreen canvas at output dimensions
    const expCanvas = document.createElement('canvas');
    expCanvas.width = outputWidth;
    expCanvas.height = outputHeight;
    exportCanvasRef.current = expCanvas;

    // Start a render loop that draws cropped video to the export canvas
    let expRunning = true;
    const renderExport = () => {
      if (!expRunning) return;
      const ctx = expCanvas.getContext('2d');
      if (ctx && vid.readyState >= 2) {
        const c = cropRef.current;
        const vw = vid.videoWidth;
        const vh = vid.videoHeight;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, outputWidth, outputHeight);
        ctx.drawImage(vid, c.x * vw, c.y * vh, c.w * vw, c.h * vh, 0, 0, outputWidth, outputHeight);
      }
      exportAnimRef.current = requestAnimationFrame(renderExport);
    };
    renderExport();

    // Seek to in point
    vid.currentTime = inPoint;
    await new Promise<void>(r => { const h = () => { vid.removeEventListener('seeked', h); r(); }; vid.addEventListener('seeked', h); });

    const stream = expCanvas.captureStream(30);
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: bitrate * 1_000_000,
    });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      expRunning = false;
      cancelAnimationFrame(exportAnimRef.current);
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedVideo?.name?.replace(/\.\w+$/, '') || 'export'}-crop.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
      setExportProgress(0);
    };

    recorder.start(100);
    recorderRef.current = recorder;
    vid.play();

    const checkInterval = setInterval(() => {
      const progress = (vid.currentTime - inPoint) / (outPoint - inPoint);
      setExportProgress(Math.max(0, Math.min(1, progress)));
      if (vid.currentTime >= outPoint || vid.paused) {
        clearInterval(checkInterval);
        vid.pause();
        setTimeout(() => { recorder.stop(); recorderRef.current = null; }, 200);
      }
    }, 100);
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00.0';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
  };

  const clipDuration = Math.max(0, outPoint - inPoint);

  return (
    <div style={{ display: 'flex', height: '100%', gap: 8, padding: 8, overflow: 'hidden' }}>
      {/* Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, minHeight: 0 }}>
        {/* Video + crop overlay */}
        <div id="crop-overlay" style={{ position: 'relative', flex: 1, background: '#000', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          {/* Hidden video — feeds the canvas */}
          <video ref={videoRef} style={{ position: 'fixed', top: -9999, left: -9999, width: 320, height: 240, pointerEvents: 'none' }} playsInline muted />

          {/* Output canvas — visible preview */}
          <canvas ref={canvasRef} style={{
            maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto',
            display: 'block', borderRadius: 4,
          }} />

          {/* Crop drag handles — positioned over the canvas crop region */}
          <div style={{
            position: 'absolute',
            left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
            cursor: 'move', pointerEvents: 'auto',
          }} onMouseDown={e => handleCropMouseDown(e, 'move')}>
            {['tl', 'tr', 'bl', 'br'].map(h => (
              <div key={h} onMouseDown={e => { e.stopPropagation(); handleCropMouseDown(e, h); }} style={{
                position: 'absolute', width: 14, height: 14, background: 'var(--accent)', borderRadius: 2,
                cursor: h === 'tl' || h === 'br' ? 'nwse-resize' : 'nesw-resize',
                ...(h.includes('t') ? { top: -7 } : { bottom: -7 }),
                ...(h.includes('l') ? { left: -7 } : { right: -7 }),
                pointerEvents: 'auto',
              }} />
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button onClick={togglePlay} style={{
              width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{isPlaying ? '\u23F8' : '\u25B6'}</button>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#fff' }}>{fmt(currentTime)}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>/</span>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--muted)' }}>{fmt(duration)}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => setInPoint(currentTime)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>IN</button>
              <button onClick={() => setOutPoint(currentTime)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>OUT</button>
            </div>
          </div>

          {/* Scrubber */}
          <div style={{ position: 'relative', height: 32, background: 'var(--panel-2)', borderRadius: 4, cursor: 'pointer', overflow: 'hidden' }}
            onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); seek((e.clientX - rect.left) / rect.width * duration); }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(inPoint / (duration || 1)) * 100}%`, width: `${((outPoint - inPoint) / (duration || 1)) * 100}%`, background: 'rgba(255,0,64,0.15)' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(currentTime / (duration || 1)) * 100}%`, width: 2, background: '#fff' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(inPoint / (duration || 1)) * 100}%`, width: 3, background: 'var(--accent)' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(outPoint / (duration || 1)) * 100}%`, width: 3, background: 'var(--accent)' }} />
            <div style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 8, color: 'var(--muted)', fontFamily: 'monospace' }}>IN {fmt(inPoint)}</div>
            <div style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 8, color: 'var(--muted)', fontFamily: 'monospace' }}>OUT {fmt(outPoint)}</div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
            Clip: {fmt(clipDuration)} &middot; {outputWidth}x{outputHeight} &middot; {bitrate}Mbps
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ width: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {/* Video picker */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Source</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
            {videoItems.map(v => (
              <button key={v.id} onClick={() => onSelectVideo(v.id)} style={{
                padding: '5px 8px', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                background: selectedVideo?.id === v.id ? 'rgba(255,0,64,0.15)' : 'var(--panel-2)',
                borderColor: selectedVideo?.id === v.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: selectedVideo?.id === v.id ? '#fff' : 'var(--muted)',
              }}>{v.name}</button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Format</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 8 }}>
            {([['landscape', '16:9'], ['portrait', '9:16'], ['square', '1:1'], ['custom', 'Custom']] as const).map(([p, label]) => (
              <button key={p} onClick={() => setPreset(p)} style={{
                padding: '5px 0', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, fontWeight: 700,
                background: preset === p ? 'var(--accent)' : 'var(--panel-2)',
                borderColor: preset === p ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: '#fff',
              }}>{label}</button>
            ))}
          </div>
          {preset === 'custom' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>W</div>
                <input type="number" value={outputWidth} onChange={e => setOutputWidth(parseInt(e.target.value) || 1280)}
                  style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: 11 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>H</div>
                <input type="number" value={outputHeight} onChange={e => setOutputHeight(parseInt(e.target.value) || 720)}
                  style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 6px', color: '#fff', fontSize: 11 }} />
              </div>
            </div>
          )}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: 'var(--muted)' }}>Bitrate</span>
              <span style={{ color: '#fff', fontFamily: 'monospace' }}>{bitrate} Mbps</span>
            </div>
            <input type="range" min={1} max={20} step={1} value={bitrate} onChange={e => setBitrate(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)', height: 4 }} />
          </div>
        </div>

        {/* Crop */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Crop</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            X: {Math.round(crop.x * 100)}% &middot; Y: {Math.round(crop.y * 100)}%<br />
            W: {Math.round(crop.w * 100)}% &middot; H: {Math.round(crop.h * 100)}%
          </div>
          <button onClick={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })} style={{
            width: '100%', marginTop: 6, padding: '5px 0', background: 'var(--panel-2)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
            color: 'var(--muted)', fontSize: 10, cursor: 'pointer',
          }}>Reset Crop</button>
        </div>

        {/* Export */}
        {isExporting ? (
          <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Exporting...</div>
            <div style={{ height: 6, background: 'var(--panel-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${exportProgress * 100}%`, background: 'var(--accent)', transition: 'width 0.1s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>{Math.round(exportProgress * 100)}%</div>
          </div>
        ) : (
          <button onClick={handleExport} disabled={!selectedVideo}
            style={{
              padding: '10px 0', background: selectedVideo ? 'var(--accent)' : 'var(--panel-2)',
              border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 2, cursor: selectedVideo ? 'pointer' : 'default',
              opacity: selectedVideo ? 1 : 0.4,
            }}>
            Export WebM
          </button>
        )}
      </div>
    </div>
  );
}
