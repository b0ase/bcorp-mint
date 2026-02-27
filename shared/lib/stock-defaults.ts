import type {
  BorderConfig,
  GradientConfig,
  GuillocheConfig,
  MicroprintConfig,
  MintDocument,
  RosetteConfig,
  SerialNumberConfig,
  StippleConfig,
  StockCertificateMetadata,
  StockShareClass,
  TextLayerConfig,
  WatermarkPatternConfig,
} from './types';
import { makeLayer, defaultRimPattern } from './mint-defaults';

export function defaultStockMetadata(): StockCertificateMetadata {
  return {
    companyName: 'Company Name',
    stateOfIncorporation: 'Delaware',
    shareClass: 'common',
    sharesAuthorized: 1000,
    parValue: 0.01,
    certificateNumber: 'CS-000001',
    holderName: '',
    issueDate: new Date().toISOString().slice(0, 10),
    cusip: '',
    transferAgent: '',
  };
}

const SHARE_CLASS_LABELS: Record<StockShareClass, string> = {
  'common': 'Common Stock',
  'preferred': 'Preferred Stock',
  'class-a': 'Class A Shares',
  'class-b': 'Class B Shares',
  'convertible': 'Convertible Preferred',
  'restricted': 'Restricted Stock',
  'treasury': 'Treasury Stock',
  'founders': 'Founders Shares',
  'employee-options': 'Employee Options',
};

function stockCertDoc(name: string, shareClass: StockShareClass, bg: string, primary: string, accent: string, text: string): MintDocument {
  const label = SHARE_CLASS_LABELS[shareClass];
  return {
    name,
    description: `${label} certificate`,
    width: 800,
    height: 1100,
    backgroundColor: bg,
    layers: [
      makeLayer('gradient', 'Background', { type: 'radial', colors: [bg, '#0a0a0a', bg], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('stipple', 'Paper Texture', { density: 200, dotSize: 0.6, color: `${primary}08`, pattern: 'halftone', seed: 42 } as StippleConfig),
      makeLayer('border', 'Ornate Border', { style: 'ornate', thickness: 36, color: primary, cornerStyle: 'ornament', innerBorder: true, innerGap: 8 } as BorderConfig),
      makeLayer('guilloche', 'Guilloche Header', { waves: 3, frequency: 10, amplitude: 35, lines: 20, strokeWidth: 0.4, color: `${primary}30`, phase: 0, damping: 0.35 } as GuillocheConfig),
      makeLayer('watermark-pattern', 'Watermark', { text: 'SHARE CERTIFICATE', fontFamily: 'Space Grotesk', fontSize: 10, color: `${primary}06`, angle: -30, spacingX: 200, spacingY: 80 } as WatermarkPatternConfig),
      makeLayer('text', 'Header', { text: 'SHARE CERTIFICATE', fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700, color: accent, letterSpacing: 8, align: 'center', x: 0.5, y: 0.06 } as TextLayerConfig),
      makeLayer('text', 'Company Name', { text: 'COMPANY NAME', fontFamily: 'Bebas Neue', fontSize: 48, fontWeight: 700, color: text, letterSpacing: 4, align: 'center', x: 0.5, y: 0.12 } as TextLayerConfig),
      makeLayer('text', 'State', { text: 'Incorporated in the State of Delaware', fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 400, color: `${text}80`, letterSpacing: 2, align: 'center', x: 0.5, y: 0.16 } as TextLayerConfig),
      makeLayer('text', 'Class Label', { text: label.toUpperCase(), fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 600, color: accent, letterSpacing: 6, align: 'center', x: 0.5, y: 0.22 } as TextLayerConfig),
      makeLayer('text', 'Certifies', { text: 'This certifies that', fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 400, color: `${text}60`, letterSpacing: 2, align: 'center', x: 0.5, y: 0.30 } as TextLayerConfig),
      makeLayer('text', 'Holder Name', { text: '_______________________________', fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 400, color: `${text}40`, letterSpacing: 0, align: 'center', x: 0.5, y: 0.35 } as TextLayerConfig),
      makeLayer('text', 'Owner Of', { text: 'is the registered owner of', fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 400, color: `${text}60`, letterSpacing: 2, align: 'center', x: 0.5, y: 0.40 } as TextLayerConfig),
      makeLayer('text', 'Share Count', { text: '1,000', fontFamily: 'Bebas Neue', fontSize: 80, fontWeight: 700, color: text, letterSpacing: 2, align: 'center', x: 0.5, y: 0.50 } as TextLayerConfig),
      makeLayer('text', 'Shares Label', { text: 'FULLY PAID AND NON-ASSESSABLE SHARES', fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 600, color: accent, letterSpacing: 4, align: 'center', x: 0.5, y: 0.56 } as TextLayerConfig),
      makeLayer('rosette', 'Seal', { petals: 16, rings: 8, radius: 0.06, strokeWidth: 0.3, color: primary, rotation: 0, innerRadius: 0.3 } as RosetteConfig),
      makeLayer('microprint', 'Microprint', { text: 'SHARE CERTIFICATE AUTHENTIC VERIFIED', fontSize: 2, color: `${primary}15`, rows: 8, angle: 0, spacing: 4 } as MicroprintConfig),
      makeLayer('serial-number', 'Certificate No.', { prefix: 'CS', startNumber: 1, digits: 6, fontFamily: 'IBM Plex Mono', fontSize: 14, color: primary, letterSpacing: 3, x: 0.85, y: 0.94 } as SerialNumberConfig),
    ],
    circleMask: false,
    rimPattern: defaultRimPattern(),
    certificateMetadata: { kind: 'stock', data: { ...defaultStockMetadata(), shareClass } },
  };
}

export type StockTemplate = {
  id: string;
  name: string;
  description: string;
  factory: () => MintDocument;
};

export const STOCK_TEMPLATES: StockTemplate[] = [
  { id: 'common-stock', name: 'Common Stock', description: 'Standard voting shares', factory: () => stockCertDoc('Common Stock', 'common', '#060012', '#c9a84c', '#e6c665', '#fff8dc') },
  { id: 'preferred-stock', name: 'Preferred Stock', description: 'Priority dividends', factory: () => stockCertDoc('Preferred Stock', 'preferred', '#0a0020', '#6a5acd', '#9370db', '#e8e0ff') },
  { id: 'class-a', name: 'Class A Shares', description: 'Enhanced voting rights', factory: () => stockCertDoc('Class A Shares', 'class-a', '#0a1a0a', '#2d8f4e', '#4caf50', '#d4e8d0') },
  { id: 'class-b', name: 'Class B Shares', description: 'Widely distributed', factory: () => stockCertDoc('Class B Shares', 'class-b', '#0a0a1a', '#1565c0', '#42a5f5', '#e3f2fd') },
  { id: 'convertible-pref', name: 'Convertible Preferred', description: 'Convertible to common', factory: () => stockCertDoc('Convertible Preferred', 'convertible', '#1a0a1a', '#7b1fa2', '#ab47bc', '#f3e5f5') },
  { id: 'restricted', name: 'Restricted Stock', description: 'Vesting schedule', factory: () => stockCertDoc('Restricted Stock', 'restricted', '#1a0f0a', '#f7931a', '#ff9800', '#fff3e0') },
  { id: 'treasury', name: 'Treasury Stock', description: 'Repurchased shares', factory: () => stockCertDoc('Treasury Stock', 'treasury', '#0a0a0a', '#808080', '#c0c0c0', '#f5f5f5') },
  { id: 'founders', name: 'Founders Shares', description: 'Founding team class', factory: () => stockCertDoc('Founders Shares', 'founders', '#0a0800', '#c9a84c', '#ffd700', '#fff8dc') },
];
