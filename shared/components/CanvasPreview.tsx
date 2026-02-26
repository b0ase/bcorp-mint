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

  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [size, setSize] = useState({ width: 800, height: 600 });

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

    // Page number
    if (pageNumber != null && pages.length > 0) {
      ctx.save();
      ctx.font = '11px "Space Grotesk", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText(String(pageNumber), size.width / 2, size.height - 6);
      ctx.restore();
    }
  }, [loadedImages, size, spreadItems, selectedId, pageNumber]);

  // --- Pointer interaction ---

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
    if (dragRef.current) {
      dragRef.current = null;
      (event.currentTarget as HTMLCanvasElement).releasePointerCapture(event.pointerId);
    }
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
        />
      )}
    </div>
  );
}
