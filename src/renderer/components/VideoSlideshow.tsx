import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { ImageItem, ImageSettings, LogoAsset } from '../lib/types';
import { loadImage, mediaStreamUrl } from '../lib/image-utils';
import { computeContainFit, drawBorderStamp, drawFrame, drawLogo, drawTextOverlays, drawVignette, drawWatermark } from '../lib/render';

type Props = {
  videos: ImageItem[];
  logos: LogoAsset[];
  looping?: boolean;
  startIndex?: number;
  onClose: () => void;
};

export default function VideoSlideshow({ videos, logos, looping = false, startIndex = 0, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  // Shared stamp settings — taken from the first video, applied to all
  const sharedSettings = useRef<ImageSettings | null>(null);
  const [logoPos, setLogoPos] = useState<{ x: number; y: number }>({ x: 0.05, y: 0.05 });
  const logoPosRef = useRef(logoPos);
  logoPosRef.current = logoPos;

  // Dragging state
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 1280, h: 720 });

  // Initialize shared settings from the video the user was viewing
  useEffect(() => {
    const sourceVideo = videos[startIndex] || videos[0];
    if (sourceVideo?.settings) {
      sharedSettings.current = { ...sourceVideo.settings };
      if (sourceVideo.settings.logoPos) {
        setLogoPos(sourceVideo.settings.logoPos);
      }
    }
  }, [videos, startIndex]);

  // Load logo image
  useEffect(() => {
    const sourceVideo = videos[startIndex] || videos[0];
    const settings = sourceVideo?.settings;
    if (!settings) return;
    const logoAsset = logos.find((l) => l.id === settings.logoId);
    if (logoAsset) {
      loadImage(logoAsset.src).then((img) => {
        logoImgRef.current = img;
      }).catch(() => {});
    }
  }, [videos, logos, startIndex]);

  const clip = videos[currentIndex];

  // Load clip
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !clip) return;
    el.src = mediaStreamUrl(clip.path);
    el.load();
    el.play().catch(() => {});
    setPaused(false);
  }, [currentIndex, clip]);

  // Video events
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onEnded = () => {
      if (looping) {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        setCurrentIndex((i) => (i + 1) % videos.length);
      }
    };
    const onTime = () => { if (el.duration) setProgress(el.currentTime / el.duration); };
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [videos.length, looping]);

  // Canvas render loop — draws video + shared stamp overlays every frame
  useEffect(() => {
    let running = true;

    const render = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) { animRef.current = requestAnimationFrame(render); return; }

      if (video.readyState >= 2 && video.videoWidth > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }
        canvasSizeRef.current = { w: vw, h: vh };

        // Draw video frame
        ctx.drawImage(video, 0, 0, vw, vh);

        // Apply shared stamp settings
        const s = sharedSettings.current;
        if (s) {
          // Use current dragged logo position
          const settingsWithPos = { ...s, logoPos: logoPosRef.current };

          // Vignette
          if (s.vignetteEnabled) {
            drawVignette(ctx, 0, 0, vw, vh, s.vignetteStrength);
          }

          // Frame
          if (s.frameEnabled) {
            const thickness = s.frameThickness * Math.min(vw, vh);
            drawFrame(ctx, 0, 0, vw, vh, thickness, s.frameColor);
          }

          // Watermark
          if (s.stampVisual?.watermarkEnabled && s.stampVisual.watermarkText) {
            drawWatermark(ctx, 0, 0, vw, vh, s.stampVisual.watermarkText, s.stampVisual.watermarkOpacity, s.stampVisual.watermarkPosition);
          }

          // Text overlays
          if (s.textOverlays && s.textOverlays.length > 0) {
            drawTextOverlays(ctx, s.textOverlays, vw, vh, 0, 0, 1, null);
          }

          // Logo — with draggable position
          const logoImg = logoImgRef.current;
          if (logoImg) {
            const dummyImg = { naturalWidth: vw, naturalHeight: vh, width: vw, height: vh } as HTMLImageElement;
            const result = drawLogo(ctx, dummyImg, logoImg, settingsWithPos, { offsetX: 0, offsetY: 0, drawWidth: vw, drawHeight: vh, scale: 1 });
            logoBoundsRef.current = { x: result.drawX, y: result.drawY, w: result.drawW, h: result.drawH };

            // Draw drag handle outline when controls visible
            if (dragRef.current) {
              ctx.save();
              ctx.strokeStyle = 'rgba(255, 0, 64, 0.6)';
              ctx.setLineDash([4, 4]);
              ctx.lineWidth = 2;
              ctx.strokeRect(result.drawX, result.drawY, result.drawW, result.drawH);
              ctx.restore();
            }
          }

          // Border stamp
          if (s.stampVisual?.borderStampEnabled && s.stampVisual.borderStampText && s.frameEnabled) {
            const thickness = s.frameThickness * Math.min(vw, vh);
            drawBorderStamp(ctx, 0, 0, vw, vh, thickness, s.stampVisual.borderStampText, s.stampVisual.borderStampColor || '#ffffff', s.stampVisual.borderStampSize || 8);
          }
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [currentIndex, videos]);

  // ── Logo dragging ──────────────────────────────────────────────────
  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (!pt || !logoBoundsRef.current) return;
    const b = logoBoundsRef.current;
    // Hit test logo bounds
    if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
      dragRef.current = { offsetX: pt.x - b.x, offsetY: pt.y - b.y };
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }, [getCanvasPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const { w, h } = canvasSizeRef.current;
    const bounds = logoBoundsRef.current;
    if (!bounds) return;
    // Convert drag position to normalized 0-1 coordinates
    const newX = (pt.x - dragRef.current.offsetX) / w;
    const newY = (pt.y - dragRef.current.offsetY) / h;
    setLogoPos({ x: Math.max(0, Math.min(1, newX)), y: Math.max(0, Math.min(1, newY)) });
  }, [getCanvasPoint]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    }
  }, []);

  // ── Auto-hide controls ─────────────────────────────────────────────
  const resetHide = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [resetHide]);

  const goTo = (dir: -1 | 1) => setCurrentIndex((i) => (i + dir + videos.length) % videos.length);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    el.paused ? el.play() : el.pause();
  };

  // Swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.time;
    touchStart.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dt < 500) goTo(dx < 0 ? 1 : -1);
  };

  // Mouse drag swipe (only if not dragging logo)
  const mouseStart = useRef<{ x: number; time: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    if (!dragRef.current) mouseStart.current = { x: e.clientX, time: Date.now() };
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (!mouseStart.current) return;
    const dx = e.clientX - mouseStart.current.x;
    const dt = Date.now() - mouseStart.current.time;
    mouseStart.current = null;
    if (Math.abs(dx) > 60 && dt < 500 && !dragRef.current) goTo(dx < 0 ? 1 : -1);
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'n') goTo(1);
      if (e.key === 'ArrowLeft' || e.key === 'b') goTo(-1);
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!clip) return null;

  return (
    <div
      className="video-slideshow-overlay"
      onMouseMove={resetHide}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      {/* Hidden video element — feeds the canvas */}
      <video
        ref={videoRef}
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, pointerEvents: 'none' }}
        playsInline
        loop={videos.length === 1 && looping}
      />

      {/* Canvas with video + stamp overlays — handles logo drag */}
      <canvas
        ref={canvasRef}
        className="video-slideshow-video"
        style={{ cursor: dragRef.current ? 'grabbing' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Progress bar */}
      <div className="video-slideshow-progress">
        {videos.map((_, i) => (
          <div
            key={i}
            className={`video-slideshow-seg ${i === currentIndex ? 'active' : i < currentIndex ? 'done' : ''}`}
            onClick={() => setCurrentIndex(i)}
          >
            <div
              className="video-slideshow-seg-fill"
              style={{ width: i === currentIndex ? `${progress * 100}%` : i < currentIndex ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Minimal overlay — close button + clip info */}
      <div className={`video-slideshow-controls ${showControls ? 'visible' : ''}`}>
        <button className="video-slideshow-close" onClick={onClose}>{'\u2715'}</button>
        <div className="video-slideshow-info">
          <span className="video-slideshow-name">{clip.name}</span>
          <span className="video-slideshow-counter">{currentIndex + 1} / {videos.length}{looping ? ' \u27F3' : ''}</span>
        </div>
      </div>
    </div>
  );
}
