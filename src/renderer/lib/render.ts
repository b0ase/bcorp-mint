import type { ImageSettings, TextOverlay } from './types';

export type Fit = {
  scale: number;
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
};

export const computeContainFit = (imageWidth: number, imageHeight: number, canvasWidth: number, canvasHeight: number): Fit => {
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = (canvasWidth - drawWidth) / 2;
  const offsetY = (canvasHeight - drawHeight) / 2;

  return { scale, drawWidth, drawHeight, offsetX, offsetY };
};

export const getLogoMetrics = (
  imageWidth: number,
  imageHeight: number,
  logoWidth: number,
  logoHeight: number,
  settings: ImageSettings
) => {
  const targetWidth = imageWidth * settings.logoScale;
  const targetHeight = targetWidth * (logoHeight / logoWidth);
  const centerX = settings.logoPos.x * imageWidth;
  const centerY = settings.logoPos.y * imageHeight;
  const left = centerX - targetWidth / 2;
  const top = centerY - targetHeight / 2;

  return {
    width: targetWidth,
    height: targetHeight,
    centerX,
    centerY,
    left,
    top
  };
};

/**
 * Draws a border OUTSIDE the image rect.
 * The image occupies (x, y, width, height).
 * The frame extends outward by `thickness` on all sides.
 */
export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
  color: string
) => {
  if (thickness <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  // Top
  ctx.fillRect(x - thickness, y - thickness, width + thickness * 2, thickness);
  // Bottom
  ctx.fillRect(x - thickness, y + height, width + thickness * 2, thickness);
  // Left
  ctx.fillRect(x - thickness, y, thickness, height);
  // Right
  ctx.fillRect(x + width, y, thickness, height);
  ctx.restore();
};

export const drawVignette = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  strength: number
) => {
  if (strength <= 0) return;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const innerRadius = Math.min(width, height) * (0.2 + (1 - strength) * 0.15);
  const outerRadius = Math.max(width, height) * 0.65;
  const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.8, strength)})`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillRect(x, y, width, height);
  ctx.restore();
};

export const drawLogo = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  logo: HTMLImageElement,
  settings: ImageSettings,
  fit?: Fit
) => {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const metrics = getLogoMetrics(imageWidth, imageHeight, logo.width, logo.height, settings);
  const scale = fit?.scale ?? 1;
  const offsetX = fit?.offsetX ?? 0;
  const offsetY = fit?.offsetY ?? 0;

  const drawX = offsetX + metrics.left * scale;
  const drawY = offsetY + metrics.top * scale;
  const drawW = metrics.width * scale;
  const drawH = metrics.height * scale;

  ctx.drawImage(logo, drawX, drawY, drawW, drawH);

  return {
    drawX,
    drawY,
    drawW,
    drawH,
    metrics
  };
};

export const drawWatermark = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  opacity: number,
  position: 'center' | 'diagonal' | 'bottom-right'
) => {
  if (!text || opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#ffffff';
  const fontSize = Math.max(12, Math.min(width, height) * 0.06);
  ctx.font = `600 ${fontSize}px "IBM Plex Mono", monospace`;

  if (position === 'center') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2);
  } else if (position === 'diagonal') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const diagSize = fontSize * 0.9;
    ctx.font = `600 ${diagSize}px "IBM Plex Mono", monospace`;
    const stepX = diagSize * text.length * 0.7;
    const stepY = diagSize * 3;
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(-Math.PI / 6);
    const cols = Math.ceil(width * 1.5 / stepX);
    const rows = Math.ceil(height * 1.5 / stepY);
    for (let row = -rows; row <= rows; row++) {
      for (let col = -cols; col <= cols; col++) {
        ctx.fillText(text, col * stepX, row * stepY);
      }
    }
  } else {
    // bottom-right
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const pad = fontSize * 0.8;
    ctx.fillText(text, x + width - pad, y + height - pad);
  }

  ctx.restore();
};

export const drawBorderStamp = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  frameThickness: number,
  text: string
) => {
  if (!text || frameThickness <= 0) return;
  ctx.save();
  const fontSize = Math.max(8, frameThickness * 0.55);
  ctx.font = `500 ${fontSize}px "IBM Plex Mono", monospace`;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Draw in the center of the bottom frame border
  const stampX = x + width / 2;
  const stampY = y + height + frameThickness / 2;
  ctx.fillText(text, stampX, stampY);
  ctx.restore();
};

/**
 * Word-wrap text to fit within a given pixel width.
 * Returns an array of lines.
 */
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  if (maxWidth <= 0) return [text];
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
  }
  return lines;
};

/**
 * Draw text overlays on canvas.
 * Positions are normalised (0-1) relative to image dimensions.
 */
export const drawTextOverlays = (
  ctx: CanvasRenderingContext2D,
  overlays: TextOverlay[],
  imageWidth: number,
  imageHeight: number,
  offsetX: number,
  offsetY: number,
  scale: number,
  selectedId?: string | null
) => {
  for (const overlay of overlays) {
    if (!overlay.visible || overlay.opacity <= 0 || !overlay.text) continue;

    ctx.save();
    ctx.globalAlpha = overlay.opacity;

    const fontSize = overlay.fontSize * scale;
    ctx.font = `${overlay.fontWeight} ${fontSize}px "${overlay.fontFamily}", "Space Grotesk", sans-serif`;
    ctx.textBaseline = 'top';

    const cx = offsetX + overlay.x * imageWidth * scale;
    const cy = offsetY + overlay.y * imageHeight * scale;
    const boxWidth = overlay.width * imageWidth * scale;

    if (overlay.rotation) {
      ctx.translate(cx, cy);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    const lines = wrapText(ctx, overlay.text, boxWidth);
    const lineHeightPx = fontSize * overlay.lineHeight;
    const totalHeight = lines.length * lineHeightPx;

    // Align horizontally
    let textAlign: CanvasTextAlign = 'center';
    let anchorX = cx;
    if (overlay.align === 'left') {
      textAlign = 'left';
      anchorX = cx - boxWidth / 2;
    } else if (overlay.align === 'right') {
      textAlign = 'right';
      anchorX = cx + boxWidth / 2;
    }
    ctx.textAlign = textAlign;

    const startY = cy - totalHeight / 2;

    // Background
    if (overlay.backgroundOpacity > 0) {
      ctx.save();
      ctx.globalAlpha = overlay.opacity * overlay.backgroundOpacity;
      ctx.fillStyle = overlay.backgroundColor;
      const pad = fontSize * 0.3;
      ctx.fillRect(cx - boxWidth / 2 - pad, startY - pad, boxWidth + pad * 2, totalHeight + pad * 2);
      ctx.restore();
    }

    // Letter spacing
    ctx.fillStyle = overlay.color;
    if (overlay.letterSpacing && overlay.letterSpacing !== 0) {
      (ctx as any).letterSpacing = `${overlay.letterSpacing * scale}px`;
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], anchorX, startY + i * lineHeightPx);
    }

    // Reset letter spacing
    if (overlay.letterSpacing && overlay.letterSpacing !== 0) {
      (ctx as any).letterSpacing = '0px';
    }

    // Selection indicator
    if (overlay.id === selectedId) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      const pad = fontSize * 0.2;
      ctx.strokeRect(cx - boxWidth / 2 - pad, startY - pad, boxWidth + pad * 2, totalHeight + pad * 2);
      ctx.restore();
    }

    ctx.restore();
  }
};

/**
 * Hit-test a point against text overlays. Returns the overlay ID if hit.
 */
export const hitTestTextOverlay = (
  overlays: TextOverlay[],
  imageWidth: number,
  imageHeight: number,
  offsetX: number,
  offsetY: number,
  scale: number,
  pointX: number,
  pointY: number,
  fontSize: number
): string | null => {
  // Test in reverse order (topmost first)
  for (let i = overlays.length - 1; i >= 0; i--) {
    const overlay = overlays[i];
    if (!overlay.visible) continue;

    const cx = offsetX + overlay.x * imageWidth * scale;
    const cy = offsetY + overlay.y * imageHeight * scale;
    const boxWidth = overlay.width * imageWidth * scale;
    const fs = overlay.fontSize * scale;
    const lineHeightPx = fs * overlay.lineHeight;
    // Estimate height: assume ~3 lines max for hit testing
    const estimatedLines = Math.max(1, Math.ceil(overlay.text.length * fs * 0.6 / boxWidth));
    const totalHeight = estimatedLines * lineHeightPx;
    const pad = fs * 0.3;

    const left = cx - boxWidth / 2 - pad;
    const top = cy - totalHeight / 2 - pad;
    const right = left + boxWidth + pad * 2;
    const bottom = top + totalHeight + pad * 2;

    if (pointX >= left && pointX <= right && pointY >= top && pointY <= bottom) {
      return overlay.id;
    }
  }
  return null;
};

export const renderComposite = (
  image: HTMLImageElement,
  logo: HTMLImageElement | null,
  settings: ImageSettings
) => {
  const canvas = document.createElement('canvas');
  const imgW = image.naturalWidth || image.width;
  const imgH = image.naturalHeight || image.height;
  const frameThickness = settings.frameEnabled
    ? settings.frameThickness * Math.min(imgW, imgH)
    : 0;

  // Canvas is image size + frame on all sides
  canvas.width = imgW + frameThickness * 2;
  canvas.height = imgH + frameThickness * 2;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw image inset by frame thickness
  const ix = frameThickness;
  const iy = frameThickness;
  ctx.drawImage(image, ix, iy, imgW, imgH);

  if (settings.vignetteEnabled) {
    drawVignette(ctx, ix, iy, imgW, imgH, settings.vignetteStrength);
  }

  if (frameThickness > 0) {
    drawFrame(ctx, ix, iy, imgW, imgH, frameThickness, settings.frameColor);
  }

  if (settings.stampVisual?.watermarkEnabled && settings.stampVisual.watermarkText) {
    drawWatermark(
      ctx, ix, iy, imgW, imgH,
      settings.stampVisual.watermarkText,
      settings.stampVisual.watermarkOpacity,
      settings.stampVisual.watermarkPosition
    );
  }

  // Text overlays
  if (settings.textOverlays && settings.textOverlays.length > 0) {
    drawTextOverlays(ctx, settings.textOverlays, imgW, imgH, ix, iy, 1);
  }

  if (logo) {
    // Logo positions are relative to image area, so pass offset
    const fit: Fit = { scale: 1, drawWidth: imgW, drawHeight: imgH, offsetX: ix, offsetY: iy };
    drawLogo(ctx, image, logo, settings, fit);
  }

  if (settings.stampVisual?.borderStampEnabled && settings.stampVisual.borderStampText && frameThickness > 0) {
    drawBorderStamp(ctx, ix, iy, imgW, imgH, frameThickness, settings.stampVisual.borderStampText);
  }

  return canvas;
};
