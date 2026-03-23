import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { ImageItem, LogoAsset } from '../lib/types';
import { loadImage } from '../lib/image-utils';

// ── Cover Template Types ────────────────────────────────────────────
interface CoverTextField {
  key: string;
  label: string;
  default: string;
  font: string;
  size: number;
  weight: number;
  color: string;
  letterSpacing: number;
  x: number; // 0-1 normalized
  y: number;
  align: 'left' | 'center' | 'right';
  transform?: 'uppercase' | 'none';
  maxWidth?: number; // 0-1 normalized
  opacity?: number;
  shadow?: boolean;
}

interface CoverTemplate {
  id: string;
  name: string;
  category: 'magazine' | 'album' | 'video';
  width: number;
  height: number;
  bgColor: string;
  overlay?: { color: string; opacity: number; gradient?: string };
  fields: CoverTextField[];
}

// ── Templates ───────────────────────────────────────────────────────
const TEMPLATES: CoverTemplate[] = [
  // ── Magazine Templates ──
  {
    id: 'mag-npgx',
    name: 'NPGX Magazine',
    category: 'magazine',
    width: 1200,
    height: 1600,
    bgColor: '#000000',
    overlay: { color: '#000', opacity: 0.3, gradient: 'linear' },
    fields: [
      { key: 'masthead', label: 'Masthead', default: 'NINJA PUNK GIRLS', font: 'Impact, Arial Black, sans-serif', size: 72, weight: 900, color: '#ff0040', letterSpacing: 6, x: 0.5, y: 0.06, align: 'center', transform: 'uppercase', shadow: true },
      { key: 'issue', label: 'Issue', default: 'ISSUE 01', font: 'Helvetica Neue, Arial, sans-serif', size: 18, weight: 600, color: '#ffffff', letterSpacing: 8, x: 0.5, y: 0.11, align: 'center', transform: 'uppercase', opacity: 0.7 },
      { key: 'headline', label: 'Headline', default: 'UNDERGROUND\nEMPRESS', font: 'Impact, Arial Black, sans-serif', size: 96, weight: 900, color: '#ffffff', letterSpacing: 4, x: 0.08, y: 0.78, align: 'left', transform: 'uppercase', shadow: true },
      { key: 'subhead', label: 'Subhead', default: 'Exclusive photoshoot & interview', font: 'Helvetica Neue, Arial, sans-serif', size: 22, weight: 400, color: '#ff3366', letterSpacing: 2, x: 0.08, y: 0.92, align: 'left' },
      { key: 'tagline', label: 'Tagline', default: 'THE STREET NINJA FEMALE', font: 'Helvetica Neue, Arial, sans-serif', size: 14, weight: 500, color: '#ffffff', letterSpacing: 6, x: 0.5, y: 0.97, align: 'center', transform: 'uppercase', opacity: 0.5 },
    ]
  },
  {
    id: 'mag-editorial',
    name: 'Editorial',
    category: 'magazine',
    width: 1200,
    height: 1600,
    bgColor: '#000000',
    overlay: { color: '#000', opacity: 0.25, gradient: 'linear' },
    fields: [
      { key: 'masthead', label: 'Masthead', default: 'NPGX', font: 'Helvetica Neue, Arial, sans-serif', size: 120, weight: 900, color: '#ffffff', letterSpacing: 20, x: 0.5, y: 0.08, align: 'center', transform: 'uppercase', opacity: 0.9 },
      { key: 'headline', label: 'Headline', default: 'RAZOR\nKISSES', font: 'Georgia, Times New Roman, serif', size: 80, weight: 700, color: '#ffffff', letterSpacing: 2, x: 0.08, y: 0.75, align: 'left', shadow: true },
      { key: 'subhead', label: 'Subhead', default: 'Tokyo Gutter Punk — Album One', font: 'Helvetica Neue, Arial, sans-serif', size: 20, weight: 400, color: '#cccccc', letterSpacing: 3, x: 0.08, y: 0.9, align: 'left' },
      { key: 'issue', label: 'Issue', default: 'VOL. 1 — 2026', font: 'Helvetica Neue, Arial, sans-serif', size: 14, weight: 500, color: '#888888', letterSpacing: 6, x: 0.92, y: 0.97, align: 'right', transform: 'uppercase' },
    ]
  },
  {
    id: 'mag-bold',
    name: 'Bold',
    category: 'magazine',
    width: 1200,
    height: 1600,
    bgColor: '#0a0a0a',
    overlay: { color: '#ff0040', opacity: 0.08 },
    fields: [
      { key: 'masthead', label: 'Masthead', default: 'NPGX', font: 'Impact, Arial Black, sans-serif', size: 180, weight: 900, color: '#ff0040', letterSpacing: 30, x: 0.5, y: 0.12, align: 'center', transform: 'uppercase', shadow: true, opacity: 0.85 },
      { key: 'headline', label: 'Headline', default: 'LUNA\nCYBERBLADE', font: 'Impact, Arial Black, sans-serif', size: 110, weight: 900, color: '#ffffff', letterSpacing: 6, x: 0.5, y: 0.82, align: 'center', transform: 'uppercase', shadow: true },
      { key: 'tagline', label: 'Tagline', default: 'The future is now', font: 'Helvetica Neue, Arial, sans-serif', size: 18, weight: 400, color: '#ff3366', letterSpacing: 8, x: 0.5, y: 0.95, align: 'center', transform: 'uppercase' },
    ]
  },
  // ── Album Templates ──
  {
    id: 'album-punk',
    name: 'Punk Album',
    category: 'album',
    width: 1400,
    height: 1400,
    bgColor: '#000000',
    overlay: { color: '#000', opacity: 0.2 },
    fields: [
      { key: 'artist', label: 'Artist', default: 'NPGX', font: 'Impact, Arial Black, sans-serif', size: 48, weight: 900, color: '#ff0040', letterSpacing: 12, x: 0.5, y: 0.08, align: 'center', transform: 'uppercase', shadow: true },
      { key: 'title', label: 'Title', default: 'TOKYO\nGUTTER\nPUNK', font: 'Impact, Arial Black, sans-serif', size: 120, weight: 900, color: '#ffffff', letterSpacing: 6, x: 0.5, y: 0.5, align: 'center', transform: 'uppercase', shadow: true },
      { key: 'subtitle', label: 'Subtitle', default: 'Album One', font: 'Helvetica Neue, Arial, sans-serif', size: 20, weight: 400, color: '#888888', letterSpacing: 6, x: 0.5, y: 0.92, align: 'center', transform: 'uppercase' },
    ]
  },
  {
    id: 'album-minimal',
    name: 'Minimal Album',
    category: 'album',
    width: 1400,
    height: 1400,
    bgColor: '#0a0a0a',
    fields: [
      { key: 'artist', label: 'Artist', default: 'NPGX', font: 'Helvetica Neue, Arial, sans-serif', size: 24, weight: 300, color: '#ffffff', letterSpacing: 10, x: 0.5, y: 0.06, align: 'center', transform: 'uppercase', opacity: 0.6 },
      { key: 'title', label: 'Title', default: 'NEON BLOOD RIOT', font: 'Helvetica Neue, Arial, sans-serif', size: 36, weight: 700, color: '#ffffff', letterSpacing: 4, x: 0.5, y: 0.94, align: 'center', transform: 'uppercase' },
    ]
  },
  {
    id: 'album-single',
    name: 'Single',
    category: 'album',
    width: 1400,
    height: 1400,
    bgColor: '#000000',
    overlay: { color: '#ff0040', opacity: 0.1, gradient: 'radial' },
    fields: [
      { key: 'artist', label: 'Artist', default: 'NPGX', font: 'Impact, Arial Black, sans-serif', size: 36, weight: 900, color: '#ff0040', letterSpacing: 8, x: 0.08, y: 0.06, align: 'left', transform: 'uppercase' },
      { key: 'title', label: 'Title', default: 'KABUKICHO\nWOLF', font: 'Impact, Arial Black, sans-serif', size: 100, weight: 900, color: '#ffffff', letterSpacing: 4, x: 0.08, y: 0.85, align: 'left', transform: 'uppercase', shadow: true },
      { key: 'featuring', label: 'Featuring', default: 'ft. Luna Cyberblade', font: 'Helvetica Neue, Arial, sans-serif', size: 18, weight: 400, color: '#ff3366', letterSpacing: 2, x: 0.08, y: 0.95, align: 'left' },
    ]
  },
  // ── Video Templates (landscape 1920x1080) ──
  {
    id: 'video-title',
    name: 'Title Card',
    category: 'video',
    width: 1920,
    height: 1080,
    bgColor: '#000000',
    overlay: { color: '#000', opacity: 0.35, gradient: 'linear' },
    fields: [
      { key: 'brand', label: 'Brand', default: 'NPGX', font: 'Impact, Arial Black, sans-serif', size: 36, weight: 900, color: '#ff0040', letterSpacing: 12, x: 0.05, y: 0.06, align: 'left', transform: 'uppercase' },
      { key: 'title', label: 'Title', default: 'UNDERGROUND\nEMPRESS', font: 'Impact, Arial Black, sans-serif', size: 110, weight: 900, color: '#ffffff', letterSpacing: 4, x: 0.05, y: 0.75, align: 'left', transform: 'uppercase', shadow: true },
      { key: 'subtitle', label: 'Subtitle', default: 'Official Music Video', font: 'Helvetica Neue, Arial, sans-serif', size: 24, weight: 400, color: '#ff3366', letterSpacing: 4, x: 0.05, y: 0.92, align: 'left', transform: 'uppercase' },
    ]
  },
  {
    id: 'video-thumbnail',
    name: 'Thumbnail',
    category: 'video',
    width: 1920,
    height: 1080,
    bgColor: '#0a0a0a',
    overlay: { color: '#ff0040', opacity: 0.06 },
    fields: [
      { key: 'title', label: 'Title', default: 'RAZOR KISSES', font: 'Impact, Arial Black, sans-serif', size: 140, weight: 900, color: '#ffffff', letterSpacing: 6, x: 0.5, y: 0.5, align: 'center', transform: 'uppercase', shadow: true },
      { key: 'brand', label: 'Brand', default: 'NINJA PUNK GIRLS', font: 'Helvetica Neue, Arial, sans-serif', size: 20, weight: 600, color: '#ff0040', letterSpacing: 10, x: 0.5, y: 0.08, align: 'center', transform: 'uppercase' },
      { key: 'cta', label: 'CTA', default: 'WATCH NOW', font: 'Impact, Arial Black, sans-serif', size: 28, weight: 900, color: '#ff0040', letterSpacing: 8, x: 0.5, y: 0.92, align: 'center', transform: 'uppercase' },
    ]
  },
  {
    id: 'video-cinematic',
    name: 'Cinematic',
    category: 'video',
    width: 1920,
    height: 1080,
    bgColor: '#000000',
    overlay: { color: '#000', opacity: 0.4, gradient: 'linear' },
    fields: [
      { key: 'title', label: 'Title', default: 'HARAJUKU\nCHAINSAW', font: 'Georgia, Times New Roman, serif', size: 90, weight: 700, color: '#ffffff', letterSpacing: 3, x: 0.5, y: 0.5, align: 'center', shadow: true },
      { key: 'credit', label: 'Credit', default: 'Directed by You', font: 'Helvetica Neue, Arial, sans-serif', size: 18, weight: 300, color: '#888888', letterSpacing: 6, x: 0.5, y: 0.92, align: 'center', transform: 'uppercase' },
    ]
  },
];

type Props = {
  image: ImageItem | null;
  allImages: ImageItem[];
  logos: LogoAsset[];
  onSelectImage: (id: string) => void;
};

export default function CoverDesigner({ image, allImages, logos, onSelectImage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<CoverTemplate>(TEMPLATES[0]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [logoScale, setLogoScale] = useState(0.3);
  const [logoPos, setLogoPos] = useState({ x: 0.5, y: 0.12 });
  const [logoOpacity, setLogoOpacity] = useState(0.85);
  const logoPosRef = useRef({ x: 0.5, y: 0.12 });
  const logoBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [category, setCategory] = useState<'magazine' | 'album' | 'video'>('magazine');
  const [textPositions, setTextPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [textSizes, setTextSizes] = useState<Record<string, number>>({});
  const [textFonts, setTextFonts] = useState<Record<string, string>>({});
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Keep ref in sync
  useEffect(() => { logoPosRef.current = logoPos; }, [logoPos]);

  // Initialize text positions, sizes, fonts from template
  useEffect(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const sizes: Record<string, number> = {};
    const fonts: Record<string, string> = {};
    for (const f of template.fields) {
      pos[f.key] = { x: f.x, y: f.y };
      sizes[f.key] = f.size;
      fonts[f.key] = f.font;
    }
    setTextPositions(pos);
    setTextSizes(sizes);
    setTextFonts(fonts);
  }, [template.id]);

  // Initialize text values from template defaults
  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const f of template.fields) defaults[f.key] = f.default;
    setTexts(defaults);
  }, [template.id]);

  // Load background image
  useEffect(() => {
    if (!image?.url) { setLoadedImage(null); return; }
    loadImage(image.url).then(setLoadedImage).catch(() => setLoadedImage(null));
  }, [image?.url]);

  // Logo selection
  const [selectedLogoId, setSelectedLogoId] = useState(logos[0]?.id || '');

  // Load logo when selection changes
  useEffect(() => {
    if (logos.length === 0) return;
    const logoAsset = logos.find(l => l.id === selectedLogoId) || logos[0];
    loadImage(logoAsset.src).then(setLogoImg).catch(() => {});
  }, [logos, selectedLogoId]);

  // Draw cover
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = template.width;
    const h = template.height;
    canvas.width = w;
    canvas.height = h;

    // Background color
    ctx.fillStyle = template.bgColor;
    ctx.fillRect(0, 0, w, h);

    // Background image
    if (loadedImage) {
      const iw = loadedImage.naturalWidth;
      const ih = loadedImage.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(loadedImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    // Overlay
    if (template.overlay) {
      ctx.save();
      ctx.globalAlpha = template.overlay.opacity;
      if (template.overlay.gradient === 'linear') {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(0,0,0,0.1)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.05)');
        grad.addColorStop(1, template.overlay.color);
        ctx.fillStyle = grad;
      } else if (template.overlay.gradient === 'radial') {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
        grad.addColorStop(0, template.overlay.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = template.overlay.color;
      }
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Text fields — use draggable positions
    for (const field of template.fields) {
      const text = texts[field.key] || field.default;
      const lines = text.split('\n');
      const fontSize = textSizes[field.key] ?? field.size;
      const pos = textPositions[field.key] || { x: field.x, y: field.y };
      const x = pos.x * w;
      const lineHeight = fontSize * 1.15;

      ctx.save();
      const fontFamily = textFonts[field.key] || field.font;
      ctx.font = `${field.weight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = field.color;
      ctx.textAlign = field.align;
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = field.opacity ?? 1;

      // Native letter-spacing (supported in Chromium/Electron)
      if (field.letterSpacing > 0) {
        (ctx as any).letterSpacing = `${field.letterSpacing}px`;
      }

      if (field.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = Math.max(8, fontSize * 0.12);
        ctx.shadowOffsetX = Math.max(1, fontSize * 0.02);
        ctx.shadowOffsetY = Math.max(1, fontSize * 0.02);
      }

      const totalHeight = lines.length * lineHeight;
      const startY = pos.y * h - totalHeight / 2 + lineHeight / 2;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (field.transform === 'uppercase') line = line.toUpperCase();
        const y = startY + i * lineHeight;

        // Stroke outline for better readability on busy backgrounds
        if (field.shadow) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = Math.max(1, fontSize * 0.03);
          ctx.lineJoin = 'round';
          ctx.strokeText(line, x, y);
        }
        ctx.fillText(line, x, y);
      }

      // Reset letter-spacing
      (ctx as any).letterSpacing = '0px';
      ctx.restore();
    }

    // Logo watermark — draggable
    if (showLogo && logoImg) {
      const lw = logoImg.naturalWidth * logoScale;
      const lh = logoImg.naturalHeight * logoScale;
      const lx = logoPosRef.current.x * w - lw / 2;
      const ly = logoPosRef.current.y * h - lh / 2;
      ctx.save();
      ctx.globalAlpha = logoOpacity;
      ctx.drawImage(logoImg, lx, ly, lw, lh);
      ctx.restore();
      logoBoundsRef.current = { x: lx, y: ly, w: lw, h: lh };

      // Drag outline
      if (dragRef.current) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 64, 0.6)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.strokeRect(lx, ly, lw, lh);
        ctx.restore();
      }
    }
  }, [template, texts, loadedImage, logoImg, showLogo, logoScale, logoPos, logoOpacity, textPositions, textSizes, textFonts, dragTarget]);

  useEffect(() => { draw(); }, [draw]);

  // ── Logo + text dragging ────────────────────────────────────────────

  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const w = template.width;
    const h = template.height;

    // Hit test logo first
    if (showLogo && logoBoundsRef.current) {
      const b = logoBoundsRef.current;
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
        dragRef.current = { offsetX: pt.x - (logoPosRef.current.x * w), offsetY: pt.y - (logoPosRef.current.y * h) };
        setDragTarget('logo');
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }

    // Hit test text fields (reverse order = top layer first)
    for (let i = template.fields.length - 1; i >= 0; i--) {
      const field = template.fields[i];
      const pos = textPositions[field.key] || { x: field.x, y: field.y };
      const fx = pos.x * w;
      const fy = pos.y * h;
      const text = texts[field.key] || field.default;
      const lines = text.split('\n');
      const lineH = field.size * 1.15;
      const totalH = lines.length * lineH;
      const estW = field.size * 0.6 * Math.max(...lines.map(l => l.length)) + field.letterSpacing * Math.max(...lines.map(l => l.length));
      const hitX = field.align === 'center' ? fx - estW / 2 : field.align === 'right' ? fx - estW : fx;
      const hitY = fy - totalH / 2;

      if (pt.x >= hitX - 10 && pt.x <= hitX + estW + 10 && pt.y >= hitY - 10 && pt.y <= hitY + totalH + 10) {
        dragOffsetRef.current = { x: pt.x - fx, y: pt.y - fy };
        setDragTarget(field.key);
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
  }, [getCanvasPoint, template, showLogo, texts, textPositions]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragTarget) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const w = template.width;
    const h = template.height;

    if (dragTarget === 'logo' && dragRef.current) {
      setLogoPos({
        x: Math.max(0, Math.min(1, (pt.x - dragRef.current.offsetX) / w)),
        y: Math.max(0, Math.min(1, (pt.y - dragRef.current.offsetY) / h)),
      });
    } else {
      setTextPositions(prev => ({
        ...prev,
        [dragTarget]: {
          x: Math.max(0, Math.min(1, (pt.x - dragOffsetRef.current.x) / w)),
          y: Math.max(0, Math.min(1, (pt.y - dragOffsetRef.current.y) / h)),
        }
      }));
    }
  }, [dragTarget, getCanvasPoint, template]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragTarget) {
      dragRef.current = null;
      setDragTarget(null);
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    }
  }, [dragTarget]);

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    await window.mint.saveFile(dataUrl, undefined, `${template.id}-cover.png`);
  };

  const filteredTemplates = TEMPLATES.filter(t => t.category === category);

  return (
    <div style={{ display: 'flex', height: '100%', gap: 8, padding: 8, overflow: 'hidden' }}>
      {/* Canvas preview — constrained to viewport */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: 8, overflow: 'hidden', minHeight: 0, minWidth: 0, padding: 12 }}>
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: template.category === 'magazine' ? '50%' : template.category === 'album' ? '70%' : '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            display: 'block',
            borderRadius: 4,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            cursor: dragTarget ? 'grabbing' : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      {/* Controls panel */}
      <div style={{ width: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {/* Category toggle */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--panel)', borderRadius: 6, padding: 2 }}>
          {(['magazine', 'album', 'video'] as const).map(cat => (
            <button key={cat} onClick={() => { setCategory(cat); setTemplate(TEMPLATES.find(t => t.category === cat)!); }}
              style={{
                flex: 1, padding: '6px 0', border: 'none', borderRadius: 4, cursor: 'pointer',
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                background: category === cat ? 'var(--accent)' : 'transparent',
                color: category === cat ? '#fff' : 'var(--muted)',
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Template picker */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Template</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredTemplates.map(t => (
              <button key={t.id} onClick={() => setTemplate(t)}
                style={{
                  padding: '8px 10px', border: '1px solid', borderRadius: 6, cursor: 'pointer',
                  textAlign: 'left', fontSize: 12, fontWeight: 600,
                  background: template.id === t.id ? 'rgba(255,0,64,0.15)' : 'var(--panel-2)',
                  borderColor: template.id === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  color: template.id === t.id ? '#fff' : 'var(--muted)',
                }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Text fields */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Text</div>
          {template.fields.map(field => (
            <div key={field.key} style={{ marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 8 }}>
              <label style={{ fontSize: 10, color: 'var(--accent)', display: 'block', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{field.label}</label>
              {field.key === 'headline' || field.key === 'title' ? (
                <textarea
                  value={texts[field.key] || field.default}
                  onChange={e => setTexts(prev => ({ ...prev, [field.key]: e.target.value }))}
                  rows={2}
                  style={{
                    width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 12, resize: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={texts[field.key] || field.default}
                  onChange={e => setTexts(prev => ({ ...prev, [field.key]: e.target.value }))}
                  style={{
                    width: '100%', background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 12,
                  }}
                />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <select value={textFonts[field.key] || field.font}
                  onChange={e => setTextFonts(prev => ({ ...prev, [field.key]: e.target.value }))}
                  style={{ flex: 1, background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '3px 4px', color: '#fff', fontSize: 10 }}>
                  <option value="Impact, Arial Black, sans-serif">Impact</option>
                  <option value="Helvetica Neue, Arial, sans-serif">Helvetica</option>
                  <option value="Georgia, Times New Roman, serif">Georgia</option>
                  <option value="Bebas Neue, sans-serif">Bebas Neue</option>
                  <option value="Oswald, sans-serif">Oswald</option>
                  <option value="Space Grotesk, sans-serif">Space Grotesk</option>
                  <option value="Permanent Marker, cursive">Marker</option>
                  <option value="Bangers, cursive">Bangers</option>
                  <option value="Courier New, monospace">Courier</option>
                  <option value="IBM Plex Mono, monospace">IBM Plex Mono</option>
                </select>
                <input type="range" min={8} max={200} step={1} value={textSizes[field.key] ?? field.size}
                  onChange={e => setTextSizes(prev => ({ ...prev, [field.key]: parseInt(e.target.value) }))}
                  style={{ width: 60, accentColor: 'var(--accent)', height: 3 }} />
                <span style={{ fontSize: 9, color: '#fff', fontFamily: 'monospace', width: 24, textAlign: 'right' }}>{textSizes[field.key] ?? field.size}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Logo controls */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Logo</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={showLogo} onChange={() => setShowLogo(!showLogo)} style={{ accentColor: 'var(--accent)' }} />
            Show logo
          </label>
          {showLogo && (
            <>
              {/* Logo picker */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, marginBottom: 8 }}>
                {logos.map(l => (
                  <div key={l.id} onClick={() => setSelectedLogoId(l.id)}
                    style={{
                      aspectRatio: '1', borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                      background: 'var(--panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: l.id === selectedLogoId ? '2px solid var(--accent)' : '2px solid transparent',
                      padding: 3,
                    }}>
                    <img src={l.src} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} title={l.name} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--muted)' }}>Size</span>
                  <span style={{ color: '#fff', fontFamily: 'monospace' }}>{Math.round(logoScale * 100)}%</span>
                </div>
                <input type="range" min={0.05} max={0.8} step={0.01} value={logoScale}
                  onChange={e => setLogoScale(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', height: 4 }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--muted)' }}>Opacity</span>
                  <span style={{ color: '#fff', fontFamily: 'monospace' }}>{Math.round(logoOpacity * 100)}%</span>
                </div>
                <input type="range" min={0.1} max={1} step={0.05} value={logoOpacity}
                  onChange={e => setLogoOpacity(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', height: 4 }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Drag logo on canvas to reposition</div>
            </>
          )}
        </div>

        {/* Image palette */}
        <div style={{ background: 'var(--panel)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent)', marginBottom: 8 }}>Background Image</div>
          {allImages.filter(i => i.mediaType === 'image').length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: 8 }}>
              Load images in the sidebar
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
              {allImages.filter(i => i.mediaType === 'image').map(img => (
                <div key={img.id} onClick={() => onSelectImage(img.id)}
                  style={{
                    aspectRatio: '1', borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                    border: img.id === image?.id ? '2px solid var(--accent)' : '2px solid transparent',
                    opacity: img.id === image?.id ? 1 : 0.6,
                  }}>
                  <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <button onClick={handleExport}
          style={{
            padding: '10px 0', background: 'var(--accent)', border: 'none', borderRadius: 6,
            color: '#fff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 2, cursor: 'pointer',
          }}>
          Export PNG
        </button>
      </div>
    </div>
  );
}
