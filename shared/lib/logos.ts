import type { LogoAsset } from './types';

const encodeSvgAsset = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const mintOutline = encodeSvgAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300"><rect width="900" height="300" fill="none"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="'Space Grotesk','Helvetica Neue',Arial,sans-serif" font-size="210" letter-spacing="24" fill="none" stroke="#ffffff" stroke-width="10">bCORP</text></svg>`);
const mintSolid = encodeSvgAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300"><rect width="900" height="300" fill="none"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="'Space Grotesk','Helvetica Neue',Arial,sans-serif" font-size="210" letter-spacing="24" fill="#ffffff">bCORP</text></svg>`);
const mintStamp = encodeSvgAsset(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><circle cx="300" cy="300" r="250" fill="none" stroke="#ffffff" stroke-width="28"/><circle cx="300" cy="300" r="190" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.6"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="'Space Grotesk','Helvetica Neue',Arial,sans-serif" font-size="140" letter-spacing="18" fill="#ffffff">bCORP</text></svg>`);

export const initialLogos: LogoAsset[] = [
  { id: 'mint-outline', name: 'Outline', src: mintOutline, kind: 'builtin' },
  { id: 'mint-solid', name: 'Solid', src: mintSolid, kind: 'builtin' },
  { id: 'mint-stamp', name: 'Stamp', src: mintStamp, kind: 'builtin' }
];

export type GeneratedLogoStyle = 'solid' | 'outline' | 'stamp';

const encodeSvg = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const createTextLogo = (text: string, color: string, style: GeneratedLogoStyle): LogoAsset => {
  const safeText = text.trim() || 'LOGO';
  const id = `gen-${crypto.randomUUID()}`;
  const font = "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif";

  let svg = '';

  if (style === 'stamp') {
    svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <circle cx="300" cy="300" r="250" fill="none" stroke="${color}" stroke-width="28" />
  <circle cx="300" cy="300" r="190" fill="none" stroke="${color}" stroke-width="6" opacity="0.6" />
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family=${JSON.stringify(font)} font-size="140" letter-spacing="18" fill="${color}">${safeText}</text>
</svg>`;
  } else if (style === 'outline') {
    svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300">
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family=${JSON.stringify(font)} font-size="210" letter-spacing="24" fill="none" stroke="${color}" stroke-width="10">${safeText}</text>
</svg>`;
  } else {
    svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300">
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family=${JSON.stringify(font)} font-size="210" letter-spacing="24" fill="${color}">${safeText}</text>
</svg>`;
  }

  return {
    id,
    name: safeText.toUpperCase(),
    src: encodeSvg(svg),
    kind: 'generated'
  };
};

// --- Logo Designer types + builders ---

export type LogoLayout = 'horizontal' | 'circular' | 'stacked' | 'badge';
export type LogoFillMode = 'solid' | 'outline';
export type LogoBorderStyle = 'solid' | 'dashed' | 'double';

export type LogoBgShape = 'none' | 'rect' | 'circle' | 'diamond' | 'star' | 'hexagon';

export type LogoDesignerConfig = {
  text: string;
  subtitleText: string;
  layout: LogoLayout;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  letterSpacing: number;
  color: string;
  subtitleColor: string;
  fillMode: LogoFillMode;
  strokeWidth: number;
  strokeColor: string;
  strokeEnabled: boolean;
  outerStrokeEnabled: boolean;
  outerStrokeColor: string;
  outerStrokeWidth: number;
  opacity: number;
  rotation: number;
  skewX: number;
  skewY: number;
  scaleX: number;
  scaleY: number;
  bgEnabled: boolean;
  bgColor: string;
  bgOpacity: number;
  bgShape: LogoBgShape;
  bgShapeColor: string;
  bgShapeOpacity: number;
  bgShapeScale: number;
  borderColor: string;
  border: boolean;
  borderStyle: LogoBorderStyle;
  borderWidth: number;
  underline: boolean;
  dots: boolean;
  stars: boolean;
  shadowEnabled: boolean;
  shadowBlur: number;
  shadowColor: string;
};

export const FONT_OPTIONS = [
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
  { value: 'Arial Black', label: 'Arial Black' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
  { value: 'Permanent Marker', label: 'Permanent Marker' },
  { value: 'Bangers', label: 'Bangers' },
] as const;

export const defaultDesignerConfig: LogoDesignerConfig = {
  text: '',
  subtitleText: '',
  layout: 'horizontal',
  fontFamily: 'Space Grotesk',
  fontWeight: 700,
  fontSize: 100,
  letterSpacing: 12,
  color: '#ffffff',
  subtitleColor: '#ffffff',
  fillMode: 'solid',
  strokeWidth: 4,
  strokeColor: '#ff2d78',
  strokeEnabled: false,
  outerStrokeEnabled: false,
  outerStrokeColor: '#ffd700',
  outerStrokeWidth: 10,
  opacity: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  scaleX: 1,
  scaleY: 1,
  bgEnabled: false,
  bgColor: '#000000',
  bgOpacity: 0.5,
  bgShape: 'none',
  bgShapeColor: '#ffd700',
  bgShapeOpacity: 0.3,
  bgShapeScale: 1,
  borderColor: '#ffffff',
  border: false,
  borderStyle: 'solid',
  borderWidth: 2,
  underline: false,
  dots: false,
  stars: false,
  shadowEnabled: false,
  shadowBlur: 8,
  shadowColor: '#000000',
};

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const fontStack = (family: string) => `'${family}', 'Helvetica Neue', Arial, sans-serif`;

const textAttrs = (c: LogoDesignerConfig) => {
  const font = fontStack(c.fontFamily);
  const fill = c.fillMode === 'solid' ? c.color : 'none';
  let stroke = '';
  if (c.fillMode === 'outline') {
    stroke = `stroke="${c.strokeColor || c.color}" stroke-width="${c.strokeWidth}"`;
  } else if (c.strokeEnabled) {
    stroke = `stroke="${c.strokeColor}" stroke-width="${c.strokeWidth}" paint-order="stroke"`;
  }
  const filter = c.shadowEnabled ? ' filter="url(#textShadow)"' : '';
  return `font-family="${font}" font-weight="${c.fontWeight}" font-size="${c.fontSize}" letter-spacing="${c.letterSpacing}" fill="${fill}" ${stroke} opacity="${c.opacity}"${filter}`;
};

const buildOuterStrokeAttrs = (c: LogoDesignerConfig) => {
  if (!c.outerStrokeEnabled) return null;
  const font = fontStack(c.fontFamily);
  const filter = c.shadowEnabled ? ' filter="url(#textShadow)"' : '';
  return `font-family="${font}" font-weight="${c.fontWeight}" font-size="${c.fontSize}" letter-spacing="${c.letterSpacing}" fill="none" stroke="${c.outerStrokeColor}" stroke-width="${c.outerStrokeWidth}" paint-order="stroke" opacity="${c.opacity}"${filter}`;
};

const buildDefs = (c: LogoDesignerConfig) => {
  const parts: string[] = [];
  if (c.shadowEnabled) {
    parts.push(`<filter id="textShadow"><feDropShadow dx="0" dy="2" stdDeviation="${c.shadowBlur}" flood-color="${c.shadowColor}" flood-opacity="0.7"/></filter>`);
  }
  return parts.length ? `<defs>${parts.join('')}</defs>` : '';
};

const buildBg = (w: number, h: number, c: LogoDesignerConfig, rx = 0) => {
  if (!c.bgEnabled) return '';
  return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" fill="${c.bgColor}" opacity="${c.bgOpacity}"/>`;
};

const buildBgShape = (w: number, h: number, c: LogoDesignerConfig) => {
  if (c.bgShape === 'none') return '';
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2 * c.bgShapeScale;
  const fill = c.bgShapeColor;
  const opacity = c.bgShapeOpacity;

  switch (c.bgShape) {
    case 'rect':
      return `<rect x="${cx - r}" y="${cy - r * 0.7}" width="${r * 2}" height="${r * 1.4}" rx="${r * 0.08}" fill="${fill}" opacity="${opacity}"/>`;
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
    case 'diamond': {
      const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
      return `<polygon points="${pts}" fill="${fill}" opacity="${opacity}"/>`;
    }
    case 'star': {
      const points: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.45;
        points.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`);
      }
      return `<polygon points="${points.join(' ')}" fill="${fill}" opacity="${opacity}"/>`;
    }
    case 'hexagon': {
      const points: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        points.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
      }
      return `<polygon points="${points.join(' ')}" fill="${fill}" opacity="${opacity}"/>`;
    }
    default:
      return '';
  }
};

const buildTransform = (cx: number, cy: number, c: LogoDesignerConfig) => {
  const parts: string[] = [];
  if (c.rotation) parts.push(`rotate(${c.rotation} ${cx} ${cy})`);
  if (c.skewX) parts.push(`skewX(${c.skewX})`);
  if (c.skewY) parts.push(`skewY(${c.skewY})`);
  if (c.scaleX !== 1 || c.scaleY !== 1) {
    parts.push(`translate(${cx} ${cy}) scale(${c.scaleX} ${c.scaleY}) translate(${-cx} ${-cy})`);
  }
  return parts.length ? `transform="${parts.join(' ')}"` : '';
};

const buildBorderRect = (w: number, h: number, c: LogoDesignerConfig) => {
  if (!c.border) return '';
  const bc = c.borderColor || c.color;
  const bw = c.borderWidth;
  const dashArray = c.borderStyle === 'dashed' ? ' stroke-dasharray="12 6"' : '';
  const rects = c.borderStyle === 'double'
    ? `<rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="6" fill="none" stroke="${bc}" stroke-width="${bw}" opacity="${c.opacity}"/>
  <rect x="${8 + bw * 3}" y="${8 + bw * 3}" width="${w - 16 - bw * 6}" height="${h - 16 - bw * 6}" rx="4" fill="none" stroke="${bc}" stroke-width="${bw}" opacity="${c.opacity}"/>`
    : `<rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="6" fill="none" stroke="${bc}" stroke-width="${bw}"${dashArray} opacity="${c.opacity}"/>`;
  return rects;
};

const buildUnderline = (cx: number, y: number, width: number, c: LogoDesignerConfig) => {
  if (!c.underline) return '';
  const dc = c.borderColor || c.color;
  return `<line x1="${cx - width / 2}" y1="${y}" x2="${cx + width / 2}" y2="${y}" stroke="${dc}" stroke-width="${c.borderWidth + 1}" opacity="${c.opacity * 0.7}"/>`;
};

const buildDots = (cx: number, y: number, count: number, c: LogoDesignerConfig) => {
  if (!c.dots) return '';
  const dc = c.borderColor || c.color;
  const spacing = 14;
  const startX = cx - ((count - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, i) =>
    `<circle cx="${startX + i * spacing}" cy="${y}" r="3" fill="${dc}" opacity="${c.opacity * 0.5}"/>`
  ).join('\n  ');
};

const buildStars = (cx: number, cy: number, radius: number, count: number, c: LogoDesignerConfig) => {
  if (!c.stars) return '';
  const dc = c.borderColor || c.color;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="16" fill="${dc}" opacity="${c.opacity * 0.6}">&#9733;</text>`;
  }).join('\n  ');
};

const buildHorizontal = (c: LogoDesignerConfig): string => {
  const w = 900, h = 300;
  const safeText = escapeXml(c.text || 'LOGO');
  const safeSub = escapeXml(c.subtitleText);
  const sc = c.subtitleColor || c.color;
  const font = fontStack(c.fontFamily);
  const textY = safeSub ? '42%' : '52%';
  const outerAttrs = buildOuterStrokeAttrs(c);
  const outerText = outerAttrs ? `<text x="50%" y="${textY}" text-anchor="middle" dominant-baseline="middle" ${outerAttrs}>${safeText}</text>` : '';
  const subEl = safeSub
    ? `<text x="50%" y="68%" text-anchor="middle" dominant-baseline="middle" font-family="${font}" font-weight="400" font-size="${Math.round(c.fontSize * 0.35)}" letter-spacing="${c.letterSpacing * 0.8}" fill="${sc}" opacity="${c.opacity * 0.7}">${safeSub}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${buildDefs(c)}
  ${buildBg(w, h, c, 6)}
  ${buildBgShape(w, h, c)}
  <g ${buildTransform(w / 2, h / 2, c)}>
  ${buildBorderRect(w, h, c)}
  ${outerText}
  <text x="50%" y="${textY}" text-anchor="middle" dominant-baseline="middle" ${textAttrs(c)}>${safeText}</text>
  ${subEl}
  ${buildUnderline(w / 2, safeSub ? h * 0.78 : h * 0.72, w * 0.5, c)}
  ${buildDots(w / 2, safeSub ? h * 0.85 : h * 0.82, 5, c)}
  </g>
</svg>`;
};

const buildCircular = (c: LogoDesignerConfig): string => {
  const w = 600, h = 600;
  const cx = 300, cy = 300;
  const safeText = escapeXml(c.text || 'LOGO');
  const bc = c.borderColor || c.color;
  const outerAttrs = buildOuterStrokeAttrs(c);
  const outerText = outerAttrs ? `<text ${outerAttrs} text-anchor="middle"><textPath href="#arc" startOffset="50%">${safeText}</textPath></text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${buildDefs(c)}
  ${buildBg(w, h, c)}
  ${buildBgShape(w, h, c)}
  <g ${buildTransform(cx, cy, c)}>
  <circle cx="${cx}" cy="${cy}" r="250" fill="none" stroke="${bc}" stroke-width="${c.borderWidth + 1}" opacity="${c.opacity * 0.6}"/>
  <circle cx="${cx}" cy="${cy}" r="230" fill="none" stroke="${bc}" stroke-width="${c.borderWidth * 0.5 + 0.5}" opacity="${c.opacity * 0.3}"/>
  <defs>
    <path id="arc" d="M 80,300 A 220,220 0 0,1 520,300"/>
  </defs>
  ${outerText}
  <text ${textAttrs(c)} text-anchor="middle">
    <textPath href="#arc" startOffset="50%">${safeText}</textPath>
  </text>
  ${buildStars(cx, cy, 200, c.stars ? 8 : 0, c)}
  </g>
</svg>`;
};

const buildStacked = (c: LogoDesignerConfig): string => {
  const w = 600, h = 500;
  const safeText = escapeXml(c.text || 'LOGO');
  const safeSub = escapeXml(c.subtitleText);
  const sc = c.subtitleColor || c.color;
  const font = fontStack(c.fontFamily);
  const dc = c.borderColor || c.color;
  const hasRule = c.underline;
  const outerAttrs = buildOuterStrokeAttrs(c);
  const outerText = outerAttrs ? `<text x="50%" y="40%" text-anchor="middle" dominant-baseline="middle" ${outerAttrs}>${safeText}</text>` : '';
  const ruleEl = hasRule
    ? `<line x1="${w * 0.25}" y1="${h * 0.52}" x2="${w * 0.75}" y2="${h * 0.52}" stroke="${dc}" stroke-width="${c.borderWidth + 1}" opacity="${c.opacity * 0.5}"/>`
    : '';
  const subEl = safeSub
    ? `<text x="50%" y="65%" text-anchor="middle" dominant-baseline="middle" font-family="${font}" font-weight="400" font-size="${Math.round(c.fontSize * 0.4)}" letter-spacing="${c.letterSpacing}" fill="${sc}" opacity="${c.opacity * 0.7}">${safeSub}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${buildDefs(c)}
  ${buildBg(w, h, c, 6)}
  ${buildBgShape(w, h, c)}
  <g ${buildTransform(w / 2, h / 2, c)}>
  ${buildBorderRect(w, h, c)}
  ${outerText}
  <text x="50%" y="40%" text-anchor="middle" dominant-baseline="middle" ${textAttrs(c)}>${safeText}</text>
  ${ruleEl}
  ${subEl}
  ${buildDots(w / 2, h * 0.82, 7, c)}
  </g>
</svg>`;
};

const buildBadge = (c: LogoDesignerConfig): string => {
  const w = 500, h = 600;
  const safeText = escapeXml(c.text || 'LOGO');
  const safeSub = escapeXml(c.subtitleText);
  const sc = c.subtitleColor || c.color;
  const font = fontStack(c.fontFamily);
  const bc = c.borderColor || c.color;
  const shield = `M 250 30 L 450 100 L 450 350 Q 450 520 250 570 Q 50 520 50 350 L 50 100 Z`;
  const outerAttrs = buildOuterStrokeAttrs(c);
  const textY = safeSub ? '270' : '300';
  const outerText = outerAttrs ? `<text x="250" y="${textY}" text-anchor="middle" dominant-baseline="middle" ${outerAttrs}>${safeText}</text>` : '';
  const subEl = safeSub
    ? `<text x="250" y="350" text-anchor="middle" dominant-baseline="middle" font-family="${font}" font-weight="400" font-size="${Math.round(c.fontSize * 0.3)}" letter-spacing="${c.letterSpacing * 0.6}" fill="${sc}" opacity="${c.opacity * 0.7}">${safeSub}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${buildDefs(c)}
  ${buildBg(w, h, c)}
  ${buildBgShape(w, h, c)}
  <g ${buildTransform(w / 2, h / 2, c)}>
  <path d="${shield}" fill="none" stroke="${bc}" stroke-width="${c.borderWidth + 1}" opacity="${c.opacity * 0.7}"/>
  ${outerText}
  <text x="250" y="${textY}" text-anchor="middle" dominant-baseline="middle" ${textAttrs(c)}>${safeText}</text>
  ${subEl}
  ${buildStars(250, 160, 100, c.stars ? 5 : 0, c)}
  </g>
</svg>`;
};

const layoutBuilders: Record<LogoLayout, (c: LogoDesignerConfig) => string> = {
  horizontal: buildHorizontal,
  circular: buildCircular,
  stacked: buildStacked,
  badge: buildBadge,
};

export const generateDesignerLogo = (config: LogoDesignerConfig): string => {
  return layoutBuilders[config.layout](config);
};

export const designerLogoToAsset = (config: LogoDesignerConfig): LogoAsset => {
  const svg = generateDesignerLogo(config);
  return {
    id: `designer-${crypto.randomUUID()}`,
    name: `${config.layout} / ${config.fillMode} / ${config.text || 'LOGO'}`,
    src: encodeSvg(svg),
    kind: 'generated',
  };
};
