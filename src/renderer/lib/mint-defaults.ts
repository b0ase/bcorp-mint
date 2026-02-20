import type {
  BorderConfig,
  CrosshatchConfig,
  FineLineConfig,
  GradientConfig,
  GuillocheConfig,
  HologramConfig,
  ImageLayerConfig,
  LatheConfig,
  MicroprintConfig,
  MintDocument,
  MintLayer,
  MintLayerTransform,
  MoireConfig,
  QRCodeConfig,
  RosetteConfig,
  SecurityThreadConfig,
  SerialNumberConfig,
  StippleConfig,
  TextArcConfig,
  TextLayerConfig,
  WatermarkPatternConfig
} from './types';

export const defaultTransform = (): MintLayerTransform => ({ x: 0, y: 0, rotation: 0, scale: 1 });

export function defaultGuillocheConfig(): GuillocheConfig {
  return { waves: 3, frequency: 8, amplitude: 60, lines: 30, strokeWidth: 0.8, color: '#ff2d78', phase: 0, damping: 0.4 };
}

export function defaultRosetteConfig(): RosetteConfig {
  return { petals: 12, rings: 8, radius: 0.35, strokeWidth: 0.6, color: '#ff69b4', rotation: 0, innerRadius: 0.3 };
}

export function defaultFineLineConfig(): FineLineConfig {
  return { angle: 45, spacing: 6, strokeWidth: 0.4, color: 'rgba(255, 255, 255, 0.15)', wave: false, waveAmplitude: 3, waveFrequency: 4 };
}

export function defaultBorderConfig(): BorderConfig {
  return { style: 'classic', thickness: 40, color: '#ff2d78', cornerStyle: 'square', innerBorder: true, innerGap: 8 };
}

export function defaultMicroprintConfig(): MicroprintConfig {
  return { text: 'THE MINT BITCOIN CORPORATION', fontSize: 3, color: 'rgba(255, 255, 255, 0.2)', rows: 12, angle: 0, spacing: 6 };
}

export function defaultTextLayerConfig(): TextLayerConfig {
  return { text: 'THE MINT', fontFamily: 'Space Grotesk', fontSize: 64, fontWeight: 700, color: '#ffffff', letterSpacing: 8, align: 'center', x: 0.5, y: 0.5 };
}

export function defaultImageLayerConfig(): ImageLayerConfig {
  return { src: '', fit: 'contain', x: 0.5, y: 0.5, scale: 1 };
}

export function defaultSerialNumberConfig(): SerialNumberConfig {
  return { prefix: 'AA', startNumber: 1, digits: 6, fontFamily: 'IBM Plex Mono', fontSize: 24, color: '#ffffff', letterSpacing: 4, x: 0.85, y: 0.9 };
}

export function defaultSecurityThreadConfig(): SecurityThreadConfig {
  return { x: 0.33, width: 4, color: 'rgba(255, 255, 255, 0.15)', text: 'THE MINT', textColor: 'rgba(255, 255, 255, 0.3)', dashed: true, dashLength: 30, gapLength: 15 };
}

export function defaultLatheConfig(): LatheConfig {
  return { lineCount: 60, strokeWidth: 0.3, color: 'rgba(255, 255, 255, 0.08)', centerX: 0.5, centerY: 0.5, scale: 1, rotation: 0 };
}

export function defaultGradientConfig(): GradientConfig {
  return { type: 'linear', colors: ['#1a0030', '#0a0a2e', '#1a0030'], angle: 90, opacity: 0.5 };
}

export function defaultQRCodeConfig(): QRCodeConfig {
  return { text: 'THE MINT', size: 0.15, x: 0.9, y: 0.1, color: '#ffffff', backgroundColor: 'transparent' };
}

export function defaultTextArcConfig(): TextArcConfig {
  return { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, color: '#ffffff', letterSpacing: 4, radius: 0.35, startAngle: -90, centerX: 0.5, centerY: 0.5, flipText: false };
}

export function defaultMoireConfig(): MoireConfig {
  return { angle1: 0, angle2: 5, spacing: 4, strokeWidth: 0.3, color: 'rgba(255, 255, 255, 0.1)' };
}

export function defaultCrosshatchConfig(): CrosshatchConfig {
  return { angle: 45, spacing: 8, strokeWidth: 0.3, color: 'rgba(255, 255, 255, 0.08)', sets: 2 };
}

export function defaultStippleConfig(): StippleConfig {
  return { density: 200, dotSize: 1, color: 'rgba(255, 255, 255, 0.1)', pattern: 'random', seed: 42 };
}

export function defaultWatermarkPatternConfig(): WatermarkPatternConfig {
  return { text: 'THE MINT', fontFamily: 'Space Grotesk', fontSize: 18, color: 'rgba(255, 255, 255, 0.04)', angle: -30, spacingX: 200, spacingY: 80 };
}

export function defaultHologramConfig(): HologramConfig {
  return { colors: ['#ff0080', '#8000ff', '#0080ff', '#00ff80', '#ffff00', '#ff0080'], angle: 45, stripWidth: 8, shimmer: 0.5, x: 0.05, y: 0.05, width: 0.2, height: 0.15 };
}

export function makeLayer(type: MintLayer['type'], name: string, config: MintLayer['config']): MintLayer {
  return {
    id: crypto.randomUUID(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    uvOnly: false,
    transform: defaultTransform(),
    type,
    config
  } as MintLayer;
}

export const defaultRimPattern = () => ({ enabled: false, teeth: 120, depth: 6, color: '#daa520' });

export function defaultMintDocument(): MintDocument {
  return {
    name: '',
    description: '',
    width: 1200,
    height: 600,
    backgroundColor: '#0a0a0a',
    layers: [
      makeLayer('border', 'Border', defaultBorderConfig()),
      makeLayer('guilloche', 'Guilloche', defaultGuillocheConfig())
    ],
    circleMask: false,
    rimPattern: defaultRimPattern()
  };
}

// --- Color Scheme Presets ---

export type ColorScheme = {
  name: string;
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
};

export const COLOR_SCHEMES: ColorScheme[] = [
  { name: 'Mint Pink', background: '#0a0a0a', primary: '#ff2d78', secondary: '#ff69b4', accent: '#ffd700', text: '#ffffff' },
  { name: 'USD Green', background: '#0a1a0a', primary: '#2d8f4e', secondary: '#1a6b37', accent: '#4caf50', text: '#d4e8d0' },
  { name: 'Euro Blue', background: '#0a0a1a', primary: '#1565c0', secondary: '#42a5f5', accent: '#ffd54f', text: '#e3f2fd' },
  { name: 'GBP Purple', background: '#1a0a1a', primary: '#7b1fa2', secondary: '#ab47bc', accent: '#ffd700', text: '#f3e5f5' },
  { name: 'BTC Orange', background: '#1a0f0a', primary: '#f7931a', secondary: '#ff9800', accent: '#ffffff', text: '#fff3e0' },
  { name: 'Gold Reserve', background: '#0a0800', primary: '#ffd700', secondary: '#daa520', accent: '#ffffff', text: '#fff8dc' },
  { name: 'Silver Standard', background: '#0a0a0a', primary: '#c0c0c0', secondary: '#808080', accent: '#e0e0e0', text: '#f5f5f5' },
  { name: 'Swiss Red', background: '#1a0a0a', primary: '#d32f2f', secondary: '#ef5350', accent: '#ffffff', text: '#ffebee' },
  { name: 'Noir', background: '#000000', primary: '#333333', secondary: '#555555', accent: '#888888', text: '#cccccc' },
  { name: 'Neon', background: '#0a0010', primary: '#ff2d78', secondary: '#00e5ff', accent: '#ffd700', text: '#e0f7fa' },
];

// --- Document Templates ---

export type MintTemplate = {
  id: string;
  name: string;
  description: string;
  factory: () => MintDocument;
};

const docBase = (name: string, w: number, h: number, bg: string, layers: MintLayer[], opts?: Partial<MintDocument>): MintDocument => ({
  name, description: '', width: w, height: h, backgroundColor: bg, layers,
  circleMask: false, rimPattern: defaultRimPattern(), ...opts
});

export const MINT_TEMPLATES: MintTemplate[] = [
  {
    id: 'banknote',
    name: 'Banknote',
    description: 'Classic currency note (1200x600)',
    factory: () => docBase('Banknote', 1200, 600, '#0a0a1a', [
      makeLayer('gradient', 'Background Gradient', { type: 'linear', colors: ['#0a0020', '#0a0a2e', '#0a0020'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Fine Lines', { angle: 30, spacing: 8, strokeWidth: 0.3, color: 'rgba(255,255,255,0.06)', wave: false, waveAmplitude: 3, waveFrequency: 4 } as FineLineConfig),
      makeLayer('lathe', 'Lathe Background', defaultLatheConfig()),
      makeLayer('guilloche', 'Guilloche', { waves: 3, frequency: 10, amplitude: 50, lines: 25, strokeWidth: 0.6, color: '#1565c0', phase: 0, damping: 0.3 } as GuillocheConfig),
      makeLayer('border', 'Border', { style: 'ornate', thickness: 45, color: '#1565c0', cornerStyle: 'ornament', innerBorder: true, innerGap: 10 } as BorderConfig),
      makeLayer('rosette', 'Left Rosette', { petals: 16, rings: 10, radius: 0.2, strokeWidth: 0.4, color: '#42a5f5', rotation: 0, innerRadius: 0.3 } as RosetteConfig),
      makeLayer('microprint', 'Microprint', { text: 'BITCOIN CORPORATION', fontSize: 3, color: 'rgba(255,255,255,0.12)', rows: 8, angle: 0, spacing: 7 } as MicroprintConfig),
      makeLayer('security-thread', 'Security Thread', defaultSecurityThreadConfig()),
      makeLayer('text', 'Denomination', { text: '100', fontFamily: 'Bebas Neue', fontSize: 120, fontWeight: 700, color: '#e3f2fd', letterSpacing: 4, align: 'center', x: 0.8, y: 0.45 } as TextLayerConfig),
      makeLayer('text', 'Title', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 600, color: '#e3f2fd', letterSpacing: 6, align: 'center', x: 0.5, y: 0.15 } as TextLayerConfig),
      makeLayer('serial-number', 'Serial', defaultSerialNumberConfig()),
    ])
  },
  {
    id: 'coin',
    name: 'Coin',
    description: 'Circular coin design (800x800)',
    factory: () => docBase('Coin', 800, 800, '#0a0800', [
      makeLayer('gradient', 'Gold Gradient', { type: 'radial', colors: ['#ffd700', '#b8860b', '#8b6914'], angle: 0, opacity: 0.6 } as GradientConfig),
      makeLayer('rosette', 'Outer Ring', { petals: 24, rings: 4, radius: 0.48, strokeWidth: 0.8, color: '#daa520', rotation: 0, innerRadius: 0.85 } as RosetteConfig),
      makeLayer('rosette', 'Inner Ring', { petals: 12, rings: 8, radius: 0.35, strokeWidth: 0.5, color: '#ffd700', rotation: 15, innerRadius: 0.2 } as RosetteConfig),
      makeLayer('lathe', 'Edge Pattern', { lineCount: 120, strokeWidth: 0.2, color: 'rgba(255,215,0,0.2)', centerX: 0.5, centerY: 0.5, scale: 1.3, rotation: 0 } as LatheConfig),
      makeLayer('text-arc', 'Rim Text', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 600, color: '#fff8dc', letterSpacing: 6, radius: 0.42, startAngle: -90, centerX: 0.5, centerY: 0.5, flipText: false } as TextArcConfig),
      makeLayer('text', 'Value', { text: '1', fontFamily: 'Bebas Neue', fontSize: 180, fontWeight: 700, color: '#fff8dc', letterSpacing: 0, align: 'center', x: 0.5, y: 0.48 } as TextLayerConfig),
      makeLayer('text', 'Label', { text: 'BITCOIN', fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 600, color: '#fff8dc', letterSpacing: 8, align: 'center', x: 0.5, y: 0.72 } as TextLayerConfig),
    ], { circleMask: true, rimPattern: { enabled: true, teeth: 120, depth: 6, color: '#daa520' } })
  },
  {
    id: 'certificate',
    name: 'Certificate',
    description: 'Formal certificate (900x1200)',
    factory: () => docBase('Certificate', 900, 1200, '#fdf8f0', [
      makeLayer('fine-line', 'Background Lines', { angle: 90, spacing: 10, strokeWidth: 0.2, color: 'rgba(0,0,0,0.03)', wave: false, waveAmplitude: 3, waveFrequency: 4 } as FineLineConfig),
      makeLayer('border', 'Ornate Border', { style: 'ornate', thickness: 50, color: '#8b6914', cornerStyle: 'ornament', innerBorder: true, innerGap: 12 } as BorderConfig),
      makeLayer('guilloche', 'Watermark Pattern', { waves: 4, frequency: 6, amplitude: 40, lines: 15, strokeWidth: 0.4, color: 'rgba(139,105,20,0.1)', phase: 30, damping: 0.5 } as GuillocheConfig),
      makeLayer('rosette', 'Seal', { petals: 16, rings: 6, radius: 0.12, strokeWidth: 0.5, color: '#8b6914', rotation: 0, innerRadius: 0.3 } as RosetteConfig),
      makeLayer('watermark-pattern', 'Watermark', { text: 'AUTHENTIC', fontFamily: 'Georgia', fontSize: 14, color: 'rgba(139,105,20,0.04)', angle: -30, spacingX: 180, spacingY: 60 } as WatermarkPatternConfig),
      makeLayer('text', 'Title', { text: 'CERTIFICATE', fontFamily: 'Georgia', fontSize: 48, fontWeight: 700, color: '#2c1810', letterSpacing: 12, align: 'center', x: 0.5, y: 0.12 } as TextLayerConfig),
      makeLayer('text', 'Subtitle', { text: 'OF AUTHENTICITY', fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 400, color: '#5c4030', letterSpacing: 8, align: 'center', x: 0.5, y: 0.17 } as TextLayerConfig),
      makeLayer('microprint', 'Security Text', { text: 'CERTIFIED AUTHENTIC', fontSize: 2.5, color: 'rgba(44,24,16,0.08)', rows: 6, angle: 0, spacing: 5 } as MicroprintConfig),
      makeLayer('serial-number', 'Certificate No.', { prefix: 'CERT', startNumber: 1, digits: 8, fontFamily: 'IBM Plex Mono', fontSize: 16, color: '#5c4030', letterSpacing: 3, x: 0.5, y: 0.92 } as SerialNumberConfig),
      makeLayer('qr-code', 'QR Code', { text: 'CERT-0001', size: 0.08, x: 0.88, y: 0.88, color: '#5c4030', backgroundColor: 'transparent' } as QRCodeConfig),
    ])
  },
  {
    id: 'token-icon',
    name: 'Token Icon',
    description: 'BSV-21 token icon (512x512)',
    factory: () => docBase('Token Icon', 512, 512, '#0a0a0a', [
      makeLayer('gradient', 'Background', { type: 'radial', colors: ['#1a0030', '#0a0a0a'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('rosette', 'Pattern', { petals: 8, rings: 5, radius: 0.45, strokeWidth: 0.8, color: '#ff2d78', rotation: 0, innerRadius: 0.2 } as RosetteConfig),
      makeLayer('text', 'Symbol', { text: '$TOKEN', fontFamily: 'Space Grotesk', fontSize: 72, fontWeight: 700, color: '#ffffff', letterSpacing: 4, align: 'center', x: 0.5, y: 0.5 } as TextLayerConfig),
    ])
  },
  {
    id: 'stamp',
    name: 'Postage Stamp',
    description: 'Compact stamp design (400x500)',
    factory: () => docBase('Postage Stamp', 400, 500, '#1a0020', [
      makeLayer('gradient', 'Tint', { type: 'linear', colors: ['#200040', '#1a0030', '#200040'], angle: 45, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Background', { angle: 60, spacing: 4, strokeWidth: 0.2, color: 'rgba(255,255,255,0.05)', wave: true, waveAmplitude: 2, waveFrequency: 6 } as FineLineConfig),
      makeLayer('border', 'Frame', { style: 'geometric', thickness: 25, color: '#ff2d78', cornerStyle: 'square', innerBorder: true, innerGap: 6 } as BorderConfig),
      makeLayer('microprint', 'Border Text', { text: 'BSV POSTAGE', fontSize: 2, color: 'rgba(255,45,120,0.2)', rows: 20, angle: 0, spacing: 4 } as MicroprintConfig),
      makeLayer('text', 'Value', { text: '1 SAT', fontFamily: 'Bebas Neue', fontSize: 48, fontWeight: 700, color: '#ffffff', letterSpacing: 4, align: 'center', x: 0.5, y: 0.85 } as TextLayerConfig),
    ])
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Empty 1200x600 canvas',
    factory: () => defaultMintDocument()
  }
];
