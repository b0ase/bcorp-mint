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
  return { waves: 3, frequency: 8, amplitude: 60, lines: 30, strokeWidth: 0.8, color: '#c9a84c', phase: 0, damping: 0.4 };
}

export function defaultRosetteConfig(): RosetteConfig {
  return { petals: 12, rings: 8, radius: 0.35, strokeWidth: 0.6, color: '#daa520', rotation: 0, innerRadius: 0.3 };
}

export function defaultFineLineConfig(): FineLineConfig {
  return { angle: 45, spacing: 6, strokeWidth: 0.4, color: 'rgba(255, 255, 255, 0.15)', wave: false, waveAmplitude: 3, waveFrequency: 4 };
}

export function defaultBorderConfig(): BorderConfig {
  return { style: 'classic', thickness: 40, color: '#c9a84c', cornerStyle: 'square', innerBorder: true, innerGap: 8 };
}

export function defaultMicroprintConfig(): MicroprintConfig {
  return { text: 'NPG MINT', fontSize: 3, color: 'rgba(255, 255, 255, 0.2)', rows: 12, angle: 0, spacing: 6 };
}

export function defaultTextLayerConfig(): TextLayerConfig {
  return { text: 'NPG MINT', fontFamily: 'Space Grotesk', fontSize: 64, fontWeight: 700, color: '#ffffff', letterSpacing: 8, align: 'center', x: 0.5, y: 0.5 };
}

export function defaultImageLayerConfig(): ImageLayerConfig {
  return { src: '', fit: 'contain', x: 0.5, y: 0.5, scale: 1 };
}

export function defaultSerialNumberConfig(): SerialNumberConfig {
  return { prefix: 'AA', startNumber: 1, digits: 6, fontFamily: 'IBM Plex Mono', fontSize: 24, color: '#ffffff', letterSpacing: 4, x: 0.85, y: 0.9 };
}

export function defaultSecurityThreadConfig(): SecurityThreadConfig {
  return { x: 0.33, width: 4, color: 'rgba(255, 255, 255, 0.15)', text: 'NPG MINT', textColor: 'rgba(255, 255, 255, 0.3)', dashed: true, dashLength: 30, gapLength: 15 };
}

export function defaultLatheConfig(): LatheConfig {
  return { lineCount: 60, strokeWidth: 0.3, color: 'rgba(255, 255, 255, 0.08)', centerX: 0.5, centerY: 0.5, scale: 1, rotation: 0 };
}

export function defaultGradientConfig(): GradientConfig {
  return { type: 'linear', colors: ['#1a1000', '#0a0800', '#1a1000'], angle: 90, opacity: 0.5 };
}

export function defaultQRCodeConfig(): QRCodeConfig {
  return { text: 'NPG MINT', size: 0.15, x: 0.9, y: 0.1, color: '#ffffff', backgroundColor: '#000000' };
}

export function defaultTextArcConfig(): TextArcConfig {
  return { text: 'NPG', fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 600, color: '#ffffff', letterSpacing: 4, radius: 0.35, startAngle: -90, centerX: 0.5, centerY: 0.5, flipText: false };
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
  return { text: 'NPG MINT', fontFamily: 'Space Grotesk', fontSize: 18, color: 'rgba(255, 255, 255, 0.04)', angle: -30, spacingX: 200, spacingY: 80 };
}

export function defaultHologramConfig(): HologramConfig {
  return { colors: ['#c9a84c', '#e6c665', '#daa520', '#b8860b', '#ffd700', '#c9a84c'], angle: 45, stripWidth: 8, shimmer: 0.5, x: 0.05, y: 0.05, width: 0.2, height: 0.15 };
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
    backgroundColor: '#0a0800',
    layers: [
      makeLayer('fine-line', 'Background Lines', { angle: 30, spacing: 8, strokeWidth: 0.3, color: 'rgba(201,168,76,0.06)', wave: false, waveAmplitude: 3, waveFrequency: 4 } as FineLineConfig),
      makeLayer('guilloche', 'Guilloche', defaultGuillocheConfig()),
      makeLayer('border', 'Border', defaultBorderConfig())
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
  { name: 'NPG Pink', background: '#0d0a12', primary: '#e91e8c', secondary: '#9b59b6', accent: '#ff69b4', text: '#ffffff' },
  { name: 'USD Green', background: '#0a1a0a', primary: '#2d8f4e', secondary: '#1a6b37', accent: '#4caf50', text: '#d4e8d0' },
  { name: 'Euro Blue', background: '#0a0a1a', primary: '#1565c0', secondary: '#42a5f5', accent: '#ffd54f', text: '#e3f2fd' },
  { name: 'GBP Purple', background: '#1a0a1a', primary: '#7b1fa2', secondary: '#ab47bc', accent: '#ffd700', text: '#f3e5f5' },
  { name: 'BTC Orange', background: '#1a0f0a', primary: '#f7931a', secondary: '#ff9800', accent: '#ffffff', text: '#fff3e0' },
  { name: 'Silver Standard', background: '#0a0a0a', primary: '#c0c0c0', secondary: '#808080', accent: '#e0e0e0', text: '#f5f5f5' },
  { name: 'Swiss Red', background: '#1a0a0a', primary: '#d32f2f', secondary: '#ef5350', accent: '#ffffff', text: '#ffebee' },
  { name: 'Noir', background: '#000000', primary: '#333333', secondary: '#555555', accent: '#888888', text: '#cccccc' },
  { name: 'Neon', background: '#0a0010', primary: '#00e5ff', secondary: '#7b2dff', accent: '#ffd700', text: '#e0f7fa' },
  { name: 'Rose', background: '#0a0a0a', primary: '#ff2d78', secondary: '#ff69b4', accent: '#ffd700', text: '#ffffff' },
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
      makeLayer('microprint', 'Microprint', { text: 'NPG', fontSize: 3, color: 'rgba(255,255,255,0.12)', rows: 8, angle: 0, spacing: 7 } as MicroprintConfig),
      makeLayer('security-thread', 'Security Thread', defaultSecurityThreadConfig()),
      makeLayer('text', 'Denomination', { text: '100', fontFamily: 'Bebas Neue', fontSize: 120, fontWeight: 700, color: '#e3f2fd', letterSpacing: 4, align: 'center', x: 0.8, y: 0.45 } as TextLayerConfig),
      makeLayer('text', 'Title', { text: 'NPG', fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 600, color: '#e3f2fd', letterSpacing: 6, align: 'center', x: 0.5, y: 0.15 } as TextLayerConfig),
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
      makeLayer('text-arc', 'Rim Text', { text: 'NPG', fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 600, color: '#fff8dc', letterSpacing: 6, radius: 0.42, startAngle: -90, centerX: 0.5, centerY: 0.5, flipText: false } as TextArcConfig),
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
      makeLayer('qr-code', 'QR Code', { text: 'CERT-0001', size: 0.08, x: 0.88, y: 0.88, color: '#5c4030', backgroundColor: '#000000' } as QRCodeConfig),
    ])
  },
  {
    id: 'note-001',
    name: '0.001 BSV Note',
    description: 'Micro note — dust tier',
    factory: () => docBase('0.001 BSV', 1200, 600, '#0a0a0a', [
      makeLayer('gradient', 'BG', { type: 'linear', colors: ['#0a0a0a', '#1a1a1a', '#0a0a0a'], angle: 45, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Lines', { angle: 15, spacing: 12, strokeWidth: 0.2, color: 'rgba(255,255,255,0.03)', wave: false, waveAmplitude: 3, waveFrequency: 4 } as FineLineConfig),
      makeLayer('border', 'Border', { style: 'simple', thickness: 20, color: '#333333', cornerStyle: 'square', innerBorder: false, innerGap: 6 } as BorderConfig),
      makeLayer('text', 'Amount', { text: '0.001', fontFamily: 'Bebas Neue', fontSize: 140, fontWeight: 700, color: '#ffffff', letterSpacing: 6, align: 'center', x: 0.5, y: 0.4 } as TextLayerConfig),
      makeLayer('text', 'Unit', { text: 'BSV', fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 700, color: '#888888', letterSpacing: 12, align: 'center', x: 0.5, y: 0.7 } as TextLayerConfig),
      makeLayer('text', 'Issuer', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 500, color: '#444444', letterSpacing: 6, align: 'center', x: 0.5, y: 0.9 } as TextLayerConfig),
    ])
  },
  {
    id: 'note-01',
    name: '0.01 BSV Note',
    description: 'Coin tier — small change',
    factory: () => docBase('0.01 BSV', 1200, 600, '#0a0a12', [
      makeLayer('gradient', 'BG', { type: 'linear', colors: ['#0a0a1a', '#0f0f2a', '#0a0a1a'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Lines', { angle: 30, spacing: 10, strokeWidth: 0.25, color: 'rgba(100,100,200,0.04)', wave: false, waveAmplitude: 3, waveFrequency: 4 } as FineLineConfig),
      makeLayer('guilloche', 'Pattern', { waves: 2, frequency: 8, amplitude: 40, lines: 15, strokeWidth: 0.4, color: 'rgba(100,130,200,0.15)', phase: 0, damping: 0.4 } as GuillocheConfig),
      makeLayer('border', 'Border', { style: 'simple', thickness: 25, color: '#2a2a4a', cornerStyle: 'square', innerBorder: true, innerGap: 8 } as BorderConfig),
      makeLayer('text', 'Amount', { text: '0.01', fontFamily: 'Bebas Neue', fontSize: 150, fontWeight: 700, color: '#c0c8e0', letterSpacing: 6, align: 'center', x: 0.5, y: 0.4 } as TextLayerConfig),
      makeLayer('text', 'Unit', { text: 'BSV', fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 700, color: '#6070a0', letterSpacing: 14, align: 'center', x: 0.5, y: 0.7 } as TextLayerConfig),
      makeLayer('text', 'Issuer', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 500, color: '#3a3a5a', letterSpacing: 6, align: 'center', x: 0.5, y: 0.9 } as TextLayerConfig),
    ])
  },
  {
    id: 'note-1',
    name: '0.1 BSV Note',
    description: 'Note tier — everyday',
    factory: () => docBase('0.1 BSV', 1200, 600, '#0a100a', [
      makeLayer('gradient', 'BG', { type: 'linear', colors: ['#0a1a0a', '#0f2a0f', '#0a1a0a'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Lines', { angle: 25, spacing: 8, strokeWidth: 0.3, color: 'rgba(50,150,50,0.05)', wave: true, waveAmplitude: 4, waveFrequency: 3 } as FineLineConfig),
      makeLayer('guilloche', 'Pattern', { waves: 3, frequency: 10, amplitude: 45, lines: 20, strokeWidth: 0.5, color: 'rgba(45,143,78,0.2)', phase: 0, damping: 0.35 } as GuillocheConfig),
      makeLayer('rosette', 'Rosette', { petals: 12, rings: 6, radius: 0.18, strokeWidth: 0.4, color: 'rgba(45,143,78,0.15)', rotation: 0, innerRadius: 0.3 } as RosetteConfig),
      makeLayer('border', 'Border', { style: 'ornate', thickness: 35, color: '#2d8f4e', cornerStyle: 'ornament', innerBorder: true, innerGap: 10 } as BorderConfig),
      makeLayer('microprint', 'Micro', { text: 'BITCOIN CORPORATION', fontSize: 2.5, color: 'rgba(45,143,78,0.08)', rows: 6, angle: 0, spacing: 6 } as MicroprintConfig),
      makeLayer('text', 'Amount', { text: '0.1', fontFamily: 'Bebas Neue', fontSize: 160, fontWeight: 700, color: '#d4e8d0', letterSpacing: 8, align: 'center', x: 0.75, y: 0.45 } as TextLayerConfig),
      makeLayer('text', 'Unit', { text: 'BSV', fontFamily: 'Space Grotesk', fontSize: 40, fontWeight: 700, color: '#2d8f4e', letterSpacing: 14, align: 'center', x: 0.75, y: 0.72 } as TextLayerConfig),
      makeLayer('text', 'Title', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 600, color: '#2d8f4e', letterSpacing: 8, align: 'center', x: 0.5, y: 0.1 } as TextLayerConfig),
      makeLayer('security-thread', 'Thread', defaultSecurityThreadConfig()),
    ])
  },
  {
    id: 'note-1bsv',
    name: '1 BSV Note',
    description: 'Bill tier — standard denomination',
    factory: () => docBase('1 BSV', 1200, 600, '#1a0f0a', [
      makeLayer('gradient', 'BG', { type: 'linear', colors: ['#1a0800', '#2a1200', '#1a0800'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Lines', { angle: 20, spacing: 7, strokeWidth: 0.3, color: 'rgba(247,147,26,0.05)', wave: true, waveAmplitude: 5, waveFrequency: 3 } as FineLineConfig),
      makeLayer('lathe', 'Lathe', { lineCount: 80, strokeWidth: 0.3, color: 'rgba(247,147,26,0.08)', centerX: 0.25, centerY: 0.5, scale: 0.8, rotation: 0 } as LatheConfig),
      makeLayer('guilloche', 'Guilloche', { waves: 4, frequency: 12, amplitude: 55, lines: 25, strokeWidth: 0.6, color: 'rgba(247,147,26,0.2)', phase: 0, damping: 0.3 } as GuillocheConfig),
      makeLayer('rosette', 'Left Rosette', { petals: 16, rings: 8, radius: 0.22, strokeWidth: 0.5, color: 'rgba(247,147,26,0.15)', rotation: 0, innerRadius: 0.25 } as RosetteConfig),
      makeLayer('border', 'Border', { style: 'ornate', thickness: 40, color: '#f7931a', cornerStyle: 'ornament', innerBorder: true, innerGap: 10 } as BorderConfig),
      makeLayer('microprint', 'Micro', { text: 'ONE BSV', fontSize: 3, color: 'rgba(247,147,26,0.06)', rows: 8, angle: 0, spacing: 7 } as MicroprintConfig),
      makeLayer('security-thread', 'Thread', { x: 0.35, width: 4, color: 'rgba(247,147,26,0.15)', text: 'BSV', textColor: 'rgba(247,147,26,0.3)', dashed: true, dashLength: 25, gapLength: 12 } as SecurityThreadConfig),
      makeLayer('text', 'ONE', { text: 'ONE', fontFamily: 'Bebas Neue', fontSize: 48, fontWeight: 700, color: '#fff3e0', letterSpacing: 16, align: 'center', x: 0.5, y: 0.12 } as TextLayerConfig),
      makeLayer('text', 'Amount', { text: '1', fontFamily: 'Bebas Neue', fontSize: 200, fontWeight: 700, color: '#fff3e0', letterSpacing: 0, align: 'center', x: 0.78, y: 0.45 } as TextLayerConfig),
      makeLayer('text', 'Unit', { text: 'BSV', fontFamily: 'Space Grotesk', fontSize: 48, fontWeight: 700, color: '#f7931a', letterSpacing: 16, align: 'center', x: 0.78, y: 0.75 } as TextLayerConfig),
      makeLayer('text', 'Corp', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 600, color: '#f7931a', letterSpacing: 6, align: 'center', x: 0.5, y: 0.92 } as TextLayerConfig),
      makeLayer('serial-number', 'Serial', { prefix: 'BC', startNumber: 1, digits: 6, fontFamily: 'IBM Plex Mono', fontSize: 16, color: '#f7931a', letterSpacing: 4, x: 0.12, y: 0.88 } as SerialNumberConfig),
      makeLayer('qr-code', 'QR', { text: 'VERIFY', size: 0.1, x: 0.12, y: 0.55, color: '#f7931a', backgroundColor: '#000000' } as QRCodeConfig),
    ])
  },
  {
    id: 'note-10bsv',
    name: '10 BSV Note',
    description: 'Bond tier — high value',
    factory: () => docBase('10 BSV', 1200, 600, '#0a0a1a', [
      makeLayer('gradient', 'BG', { type: 'linear', colors: ['#0a0020', '#12003a', '#0a0020'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Lines', { angle: 35, spacing: 6, strokeWidth: 0.3, color: 'rgba(120,50,200,0.05)', wave: true, waveAmplitude: 6, waveFrequency: 4 } as FineLineConfig),
      makeLayer('lathe', 'Lathe', { lineCount: 100, strokeWidth: 0.25, color: 'rgba(120,50,200,0.06)', centerX: 0.3, centerY: 0.5, scale: 0.9, rotation: 0 } as LatheConfig),
      makeLayer('guilloche', 'Guilloche', { waves: 5, frequency: 14, amplitude: 60, lines: 30, strokeWidth: 0.5, color: 'rgba(120,50,200,0.2)', phase: 0, damping: 0.25 } as GuillocheConfig),
      makeLayer('rosette', 'Rosette', { petals: 20, rings: 10, radius: 0.25, strokeWidth: 0.4, color: 'rgba(200,160,255,0.12)', rotation: 0, innerRadius: 0.2 } as RosetteConfig),
      makeLayer('border', 'Border', { style: 'ornate', thickness: 45, color: '#7b2dff', cornerStyle: 'ornament', innerBorder: true, innerGap: 12 } as BorderConfig),
      makeLayer('microprint', 'Micro', { text: 'TEN BSV', fontSize: 2.5, color: 'rgba(120,50,200,0.06)', rows: 10, angle: 0, spacing: 5 } as MicroprintConfig),
      makeLayer('security-thread', 'Thread', { x: 0.38, width: 5, color: 'rgba(120,50,200,0.2)', text: '10 BSV', textColor: 'rgba(200,160,255,0.4)', dashed: true, dashLength: 30, gapLength: 15 } as SecurityThreadConfig),
      makeLayer('text', 'TEN', { text: 'TEN', fontFamily: 'Bebas Neue', fontSize: 42, fontWeight: 700, color: '#e0d0ff', letterSpacing: 20, align: 'center', x: 0.5, y: 0.12 } as TextLayerConfig),
      makeLayer('text', 'Amount', { text: '10', fontFamily: 'Bebas Neue', fontSize: 200, fontWeight: 700, color: '#e0d0ff', letterSpacing: 8, align: 'center', x: 0.78, y: 0.45 } as TextLayerConfig),
      makeLayer('text', 'Unit', { text: 'BSV', fontFamily: 'Space Grotesk', fontSize: 48, fontWeight: 700, color: '#7b2dff', letterSpacing: 16, align: 'center', x: 0.78, y: 0.75 } as TextLayerConfig),
      makeLayer('text', 'Corp', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 600, color: '#7b2dff', letterSpacing: 6, align: 'center', x: 0.5, y: 0.92 } as TextLayerConfig),
      makeLayer('serial-number', 'Serial', { prefix: 'BC', startNumber: 1, digits: 6, fontFamily: 'IBM Plex Mono', fontSize: 18, color: '#c8a0ff', letterSpacing: 4, x: 0.12, y: 0.88 } as SerialNumberConfig),
      makeLayer('qr-code', 'QR', { text: 'VERIFY', size: 0.12, x: 0.12, y: 0.55, color: '#7b2dff', backgroundColor: '#000000' } as QRCodeConfig),
      makeLayer('hologram', 'Hologram', defaultHologramConfig()),
    ])
  },
  {
    id: 'note-100bsv',
    name: '100 BSV Note',
    description: 'Certificate tier — institutional',
    factory: () => docBase('100 BSV', 1200, 600, '#1a0a0a', [
      makeLayer('gradient', 'BG', { type: 'linear', colors: ['#1a0000', '#2a0a0a', '#1a0000'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Lines 1', { angle: 40, spacing: 4, strokeWidth: 0.3, color: 'rgba(200,50,50,0.06)', wave: true, waveAmplitude: 5, waveFrequency: 5 } as FineLineConfig),
      makeLayer('fine-line', 'Lines 2', { angle: -30, spacing: 6, strokeWidth: 0.2, color: 'rgba(200,50,50,0.04)', wave: true, waveAmplitude: 3, waveFrequency: 3 } as FineLineConfig),
      makeLayer('lathe', 'Lathe Left', { lineCount: 120, strokeWidth: 0.2, color: 'rgba(200,50,50,0.07)', centerX: 0.2, centerY: 0.5, scale: 0.8, rotation: 0 } as LatheConfig),
      makeLayer('lathe', 'Lathe Right', { lineCount: 80, strokeWidth: 0.15, color: 'rgba(255,150,100,0.04)', centerX: 0.8, centerY: 0.5, scale: 0.6, rotation: 45 } as LatheConfig),
      makeLayer('guilloche', 'Guilloche 1', { waves: 6, frequency: 16, amplitude: 65, lines: 40, strokeWidth: 0.5, color: 'rgba(200,50,50,0.2)', phase: 0, damping: 0.2 } as GuillocheConfig),
      makeLayer('guilloche', 'Guilloche 2', { waves: 4, frequency: 10, amplitude: 40, lines: 20, strokeWidth: 0.3, color: 'rgba(255,150,100,0.08)', phase: 45, damping: 0.4 } as GuillocheConfig),
      makeLayer('rosette', 'Left Rosette', { petals: 24, rings: 14, radius: 0.3, strokeWidth: 0.35, color: 'rgba(255,100,100,0.12)', rotation: 0, innerRadius: 0.15 } as RosetteConfig),
      makeLayer('rosette', 'Right Rosette', { petals: 16, rings: 8, radius: 0.18, strokeWidth: 0.3, color: 'rgba(255,215,0,0.08)', rotation: 15, innerRadius: 0.25 } as RosetteConfig),
      makeLayer('rosette', 'Center Rosette', { petals: 32, rings: 6, radius: 0.12, strokeWidth: 0.2, color: 'rgba(200,50,50,0.06)', rotation: 7, innerRadius: 0.4 } as RosetteConfig),
      makeLayer('crosshatch', 'Crosshatch', defaultCrosshatchConfig()),
      makeLayer('border', 'Border', { style: 'ornate', thickness: 50, color: '#cc3333', cornerStyle: 'ornament', innerBorder: true, innerGap: 14 } as BorderConfig),
      makeLayer('microprint', 'Micro 1', { text: 'ONE HUNDRED BSV', fontSize: 2, color: 'rgba(200,50,50,0.06)', rows: 14, angle: 0, spacing: 4 } as MicroprintConfig),
      makeLayer('microprint', 'Micro 2', { text: 'THE BITCOIN CORPORATION', fontSize: 1.8, color: 'rgba(200,50,50,0.04)', rows: 8, angle: 90, spacing: 5 } as MicroprintConfig),
      makeLayer('security-thread', 'Thread 1', { x: 0.38, width: 5, color: 'rgba(200,50,50,0.2)', text: '100 BSV', textColor: 'rgba(255,200,200,0.4)', dashed: true, dashLength: 35, gapLength: 15 } as SecurityThreadConfig),
      makeLayer('security-thread', 'Thread 2', { x: 0.62, width: 3, color: 'rgba(255,200,200,0.08)', text: 'AUTHENTIC', textColor: 'rgba(255,200,200,0.15)', dashed: true, dashLength: 20, gapLength: 25 } as SecurityThreadConfig),
      makeLayer('watermark-pattern', 'Watermark', { text: '100', fontFamily: 'Bebas Neue', fontSize: 24, color: 'rgba(200,50,50,0.03)', angle: -20, spacingX: 200, spacingY: 100 } as WatermarkPatternConfig),
      makeLayer('text', 'Hundred', { text: 'ONE HUNDRED', fontFamily: 'Bebas Neue', fontSize: 36, fontWeight: 700, color: 'rgba(255,204,204,0.85)', letterSpacing: 16, align: 'center', x: 0.5, y: 0.1 } as TextLayerConfig),
      makeLayer('text', 'Amount', { text: '100', fontFamily: 'Bebas Neue', fontSize: 200, fontWeight: 700, color: 'rgba(255,204,204,0.8)', letterSpacing: 8, align: 'center', x: 0.78, y: 0.45 } as TextLayerConfig),
      makeLayer('text', 'Unit', { text: 'BSV', fontFamily: 'Space Grotesk', fontSize: 52, fontWeight: 700, color: 'rgba(204,51,51,0.9)', letterSpacing: 16, align: 'center', x: 0.78, y: 0.75 } as TextLayerConfig),
      makeLayer('text', 'Corp', { text: 'THE BITCOIN CORPORATION', fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 600, color: 'rgba(204,51,51,0.7)', letterSpacing: 8, align: 'center', x: 0.5, y: 0.92 } as TextLayerConfig),
      makeLayer('serial-number', 'Serial', { prefix: 'BC', startNumber: 1, digits: 8, fontFamily: 'IBM Plex Mono', fontSize: 18, color: '#ff8888', letterSpacing: 4, x: 0.12, y: 0.88 } as SerialNumberConfig),
      makeLayer('qr-code', 'QR', { text: 'VERIFY', size: 0.13, x: 0.12, y: 0.5, color: '#cc3333', backgroundColor: '#000000' } as QRCodeConfig),
      makeLayer('hologram', 'Hologram', defaultHologramConfig()),
      makeLayer('moire', 'Moiré', defaultMoireConfig()),
      makeLayer('stipple', 'Stipple', defaultStippleConfig()),
    ])
  },
  {
    id: 'token-icon',
    name: 'Token Icon',
    description: 'BSV-21 token icon (512x512)',
    factory: () => docBase('Token Icon', 512, 512, '#0a0a0a', [
      makeLayer('gradient', 'Background', { type: 'radial', colors: ['#1a1000', '#0a0a0a'], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('rosette', 'Pattern', { petals: 8, rings: 5, radius: 0.45, strokeWidth: 0.8, color: '#c9a84c', rotation: 0, innerRadius: 0.2 } as RosetteConfig),
      makeLayer('text', 'Symbol', { text: '$TOKEN', fontFamily: 'Space Grotesk', fontSize: 72, fontWeight: 700, color: '#ffffff', letterSpacing: 4, align: 'center', x: 0.5, y: 0.5 } as TextLayerConfig),
    ])
  },
  {
    id: 'stamp',
    name: 'Postage Stamp',
    description: 'Compact stamp design (400x500)',
    factory: () => docBase('Postage Stamp', 400, 500, '#0a0800', [
      makeLayer('gradient', 'Tint', { type: 'linear', colors: ['#1a1000', '#0a0800', '#1a1000'], angle: 45, opacity: 1 } as GradientConfig),
      makeLayer('fine-line', 'Background', { angle: 60, spacing: 4, strokeWidth: 0.2, color: 'rgba(255,255,255,0.05)', wave: true, waveAmplitude: 2, waveFrequency: 6 } as FineLineConfig),
      makeLayer('border', 'Frame', { style: 'geometric', thickness: 25, color: '#c9a84c', cornerStyle: 'square', innerBorder: true, innerGap: 6 } as BorderConfig),
      makeLayer('microprint', 'Border Text', { text: 'BSV POSTAGE', fontSize: 2, color: 'rgba(201,168,76,0.2)', rows: 20, angle: 0, spacing: 4 } as MicroprintConfig),
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
