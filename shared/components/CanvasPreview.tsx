import React, { useEffect, useRef, useState } from 'react';
import type { ImageSettings, LogoAsset, Spread } from '@shared/lib/types';
import { loadImage } from '@shared/lib/image-utils';
import { computeContainFit, drawBorderStamp, drawFrame, drawLogo, drawVignette, drawWatermark, getLogoMetrics, type Fit } from '@shared/lib/render';

const CANVAS_BG = '#0a0a0a';
const GUTTER = 0;

type PageSlot = {
  id: string;
  img: HTMLImageElement;
  logo: HTMLImageElement | null;
  settings: ImageSettings;
  fit: Fit;
  offsetX: number; // page offset within canvas
};

type CanvasPreviewProps = {
  spread: Spread | null;
  selectedId: string | null;
  logos: LogoAsset[];
  pageNumber?: number;
  onLogoPosChange?: (pos: { x: number; y: number }) => void;
  onSelectImage?: (id: string) => void;
  wrapperClassName?: string;
};

export default function CanvasPreview({ spread, selectedId, logos, pageNumber, onLogoPosChange, onSelectImage, wrapperClassName }: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<PageSlot[]>([]);
  const dragRef = useRef<{ pageId: string; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);

  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Reset zoom/pan when spread changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [spread]);

  // Collect all image URLs and logo URLs we need
  const spreadItems = spread
    ? spread.type === 'portrait-pair'
      ? [spread.left, spread.right]
      : [spread.image]
    : [];

  // Load images for current spread
  useEffect(() => {
    if (spreadItems.length === 0) {
      setLoadedImages(new Map());
      return;
    }

    let cancelled = false;
    const urlsToLoad: { key: string; src: string }[] = [];

    for (const item of spreadItems) {
      urlsToLoad.push({ key: `img-${item.id}`, src: item.url });
      const logo = logos.find((l) => l.id === item.settings.logoId);
      if (logo) urlsToLoad.push({ key: `logo-${item.id}`, src: logo.src });
    }

    Promise.all(
      urlsToLoad.map(async ({ key, src }) => {
        try {
          const el = await loadImage(src);
          return [key, el] as [string, HTMLImageElement];
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<string, HTMLImageElement>();
      for (const r of results) {
        if (r) map.set(r[0], r[1]);
      }
      setLoadedImages(map);
    });

    return () => { cancelled = true; };
  }, [spread, logos]);

  // Observe container size
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(size.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(size.height * pixelRatio));
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, size.width, size.height);

    // Apply zoom + pan
    ctx.save();
    const cx = size.width / 2 + pan.x;
    const cy = size.height / 2 + pan.y;
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-size.width / 2, -size.height / 2);

    if (spreadItems.length === 0) {
      pagesRef.current = [];
      return;
    }

    const pages: PageSlot[] = [];
    const isPair = spreadItems.length === 2;
    const gutterTotal = isPair ? GUTTER : 0;

    for (let i = 0; i < spreadItems.length; i++) {
      const item = spreadItems[i];
      const img = loadedImages.get(`img-${item.id}`);
      if (!img) continue;

      const logo = loadedImages.get(`logo-${item.id}`) || null;
      const slotWidth = isPair ? (size.width - gutterTotal) / 2 : size.width;
      const slotOffsetX = isPair ? i * (slotWidth + GUTTER) : 0;

      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      // Reserve space for frame outside the image
      const ft = item.settings.frameEnabled
        ? item.settings.frameThickness * Math.min(imgW, imgH)
        : 0;
      // For pairs, only reserve frame space on outer edge (not the inner seam)
      const outerPadX = isPair ? ft : ft * 2;
      const fitAreaWidth = slotWidth - outerPadX;
      const fitAreaHeight = size.height - ft * 2;
      const fit = computeContainFit(imgW, imgH, Math.max(1, fitAreaWidth), Math.max(1, fitAreaHeight));

      if (isPair) {
        if (i === 0) {
          // Left page: frame padding on left, image flush to right edge of slot
          fit.offsetX = slotWidth - fit.drawWidth;
        } else {
          // Right page: frame padding on right, image flush to left edge of slot
          fit.offsetX = 0;
        }
      } else {
        fit.offsetX += ft;
      }
      fit.offsetY += ft;

      pages.push({
        id: item.id,
        img,
        logo,
        settings: item.settings,
        fit,
        offsetX: slotOffsetX
      });
    }

    pagesRef.current = pages;

    // Draw each page
    for (const page of pages) {
      const { img, logo, settings, fit, offsetX, id } = page;
      const dx = offsetX + fit.offsetX;
      const dy = fit.offsetY;

      ctx.drawImage(img, dx, dy, fit.drawWidth, fit.drawHeight);

      if (settings.vignetteEnabled) {
        drawVignette(ctx, dx, dy, fit.drawWidth, fit.drawHeight, settings.vignetteStrength);
      }

      if (settings.frameEnabled) {
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const thickness = settings.frameThickness * Math.min(imgW, imgH) * fit.scale;
        drawFrame(ctx, dx, dy, fit.drawWidth, fit.drawHeight, thickness, settings.frameColor);
      }

      // Watermark
      if (settings.stampVisual?.watermarkEnabled && settings.stampVisual.watermarkText) {
        drawWatermark(
          ctx, dx, dy, fit.drawWidth, fit.drawHeight,
          settings.stampVisual.watermarkText,
          settings.stampVisual.watermarkOpacity,
          settings.stampVisual.watermarkPosition
        );
      }

      if (logo) {
        const shiftedFit: Fit = { ...fit, offsetX: dx, offsetY: dy };
        const logoRender = drawLogo(ctx, img, logo, settings, shiftedFit);

        // Dashed outline on selected image's logo only
        if (id === selectedId) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.setLineDash([6, 6]);
          ctx.strokeRect(logoRender.drawX, logoRender.drawY, logoRender.drawW, logoRender.drawH);
          ctx.restore();
        }
      }

      // Border stamp text
      if (settings.stampVisual?.borderStampEnabled && settings.stampVisual.borderStampText && settings.frameEnabled) {
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const thickness = settings.frameThickness * Math.min(imgW, imgH) * fit.scale;
        drawBorderStamp(ctx, dx, dy, fit.drawWidth, fit.drawHeight, thickness, settings.stampVisual.borderStampText);
      }

      // Selection highlight border
      if (id === selectedId && isPair) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 45, 120, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, fit.drawWidth, fit.drawHeight);
        ctx.restore();
      }
    }

    // Restore zoom/pan transform
    ctx.restore();

    // Page number (drawn outside zoom so it stays fixed)
    if (pageNumber != null && pages.length > 0) {
      ctx.save();
      ctx.font = '11px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText(String(pageNumber), size.width / 2, size.height - 6);
      ctx.restore();
    }

    // Zoom indicator (show briefly when not 1x)
    if (zoom !== 1) {
      ctx.save();
      ctx.font = '11px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(zoom * 100)}%`, size.width - 10, 18);
      ctx.restore();
    }
  }, [loadedImages, size, spreadItems, selectedId, pageNumber, zoom, pan]);

  // --- Pointer interaction ---

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Convert screen coords to canvas coords accounting for zoom + pan
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const cx = size.width / 2 + pan.x;
    const cy = size.height / 2 + pan.y;
    const x = (screenX - cx) / zoom + size.width / 2;
    const y = (screenY - cy) / zoom + size.height / 2;
    return { x, y, screenX, screenY };
  };

  const findPage = (x: number, y: number): PageSlot | null => {
    for (const page of pagesRef.current) {
      const dx = page.offsetX + page.fit.offsetX;
      const dy = page.fit.offsetY;
      if (x >= dx && x <= dx + page.fit.drawWidth && y >= dy && y <= dy + page.fit.drawHeight) {
        return page;
      }
    }
    return null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Middle-click or Alt+click → pan
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      handlePanDown(event);
      return;
    }

    const point = getCanvasPoint(event);
    if (!point) return;

    const page = findPage(point.x, point.y);
    if (!page) return;

    // Click selects this image in the spread
    if (page.id !== selectedId && onSelectImage) {
      onSelectImage(page.id);
    }

    // Check if clicking on the logo for drag
    if (!page.logo || !onLogoPosChange || page.id !== selectedId) return;

    const imgW = page.img.naturalWidth || page.img.width;
    const imgH = page.img.naturalHeight || page.img.height;
    const dx = page.offsetX + page.fit.offsetX;
    const dy = page.fit.offsetY;
    const imageX = (point.x - dx) / page.fit.scale;
    const imageY = (point.y - dy) / page.fit.scale;

    const metrics = getLogoMetrics(imgW, imgH, page.logo.width, page.logo.height, page.settings);
    const isInsideLogo =
      imageX >= metrics.left &&
      imageX <= metrics.left + metrics.width &&
      imageY >= metrics.top &&
      imageY <= metrics.top + metrics.height;

    if (!isInsideLogo) return;

    dragRef.current = {
      pageId: page.id,
      offsetX: imageX - metrics.centerX,
      offsetY: imageY - metrics.centerY
    };

    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Pan takes priority
    if (panRef.current) {
      handlePanMove(event);
      return;
    }

    const drag = dragRef.current;
    if (!drag || !onLogoPosChange) return;

    const point = getCanvasPoint(event);
    if (!point) return;

    const page = pagesRef.current.find((p) => p.id === drag.pageId);
    if (!page || !page.logo) return;

    const imgW = page.img.naturalWidth || page.img.width;
    const imgH = page.img.naturalHeight || page.img.height;
    const dx = page.offsetX + page.fit.offsetX;
    const dy = page.fit.offsetY;
    const imageX = (point.x - dx) / page.fit.scale;
    const imageY = (point.y - dy) / page.fit.scale;

    const metrics = getLogoMetrics(imgW, imgH, page.logo.width, page.logo.height, page.settings);
    const halfW = metrics.width / 2;
    const halfH = metrics.height / 2;

    let centerX = imageX - drag.offsetX;
    let centerY = imageY - drag.offsetY;
    centerX = Math.max(halfW, Math.min(imgW - halfW, centerX));
    centerY = Math.max(halfH, Math.min(imgH - halfH, centerY));

    onLogoPosChange({ x: centerX / imgW, y: centerY / imgH });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (panRef.current) {
      panRef.current = null;
      (event.currentTarget as HTMLCanvasElement).releasePointerCapture(event.pointerId);
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
      (event.currentTarget as HTMLCanvasElement).releasePointerCapture(event.pointerId);
    }
  };

  // Scroll wheel zoom — zooms toward cursor position
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(10, Math.max(0.1, prev * delta)));
  };

  // Middle-click or Alt+click to pan
  const handlePanDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      event.preventDefault();
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
      (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
    }
  };

  const handlePanMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!panRef.current) return;
    const dx = event.clientX - panRef.current.startX;
    const dy = event.clientY - panRef.current.startY;
    setPan({ x: panRef.current.origPanX + dx, y: panRef.current.origPanY + dy });
  };

  // Double-click to reset zoom
  const handleDoubleClick = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className={wrapperClassName ?? 'canvas-wrapper'} ref={containerRef}>
      {!spread ? (
        <div className="canvas-placeholder">
          <div>
            <div className="pill">Load a folder or drop images</div>
            <p>Load a folder or drag and drop images to start framing, logo placement, and export.</p>
          </div>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: zoom !== 1 ? 'grab' : undefined }}
        />
      )}
    </div>
  );
}
