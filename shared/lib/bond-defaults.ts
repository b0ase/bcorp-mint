import type {
  BondCertificateMetadata,
  BondType,
  BorderConfig,
  GradientConfig,
  GuillocheConfig,
  MicroprintConfig,
  MintDocument,
  RosetteConfig,
  SerialNumberConfig,
  StippleConfig,
  TextLayerConfig,
  WatermarkPatternConfig,
} from './types';
import { makeLayer, defaultRimPattern } from './mint-defaults';

export function defaultBondMetadata(): BondCertificateMetadata {
  return {
    issuerName: 'Issuer Name',
    bondType: 'corporate',
    faceValue: 10000,
    couponRate: 5.25,
    maturityDate: new Date(Date.now() + 10 * 365.25 * 86400000).toISOString().slice(0, 10),
    paymentFrequency: 'semi-annual',
    certificateNumber: 'BD-000001',
    holderName: '',
    issueDate: new Date().toISOString().slice(0, 10),
    isin: '',
  };
}

const BOND_TYPE_LABELS: Record<BondType, string> = {
  'government': 'Government Bond',
  'corporate': 'Corporate Bond',
  'municipal': 'Municipal Bond',
  'zero-coupon': 'Zero-Coupon Bond',
  'convertible': 'Convertible Bond',
  'bearer': 'Bearer Bond',
  'savings': 'Savings Bond',
  'green': 'Green Bond',
};

function bondCertDoc(name: string, bondType: BondType, bg: string, primary: string, accent: string, text: string): MintDocument {
  const label = BOND_TYPE_LABELS[bondType];
  const isZeroCoupon = bondType === 'zero-coupon';
  return {
    name,
    description: `${label} certificate`,
    width: 800,
    height: 1100,
    backgroundColor: bg,
    layers: [
      makeLayer('gradient', 'Background', { type: 'radial', colors: [bg, '#0a0a0a', bg], angle: 0, opacity: 1 } as GradientConfig),
      makeLayer('stipple', 'Paper Texture', { density: 200, dotSize: 0.6, color: `${primary}08`, pattern: 'halftone', seed: 7 } as StippleConfig),
      makeLayer('border', 'Ornate Border', { style: 'ornate', thickness: 36, color: primary, cornerStyle: 'ornament', innerBorder: true, innerGap: 8 } as BorderConfig),
      makeLayer('guilloche', 'Guilloche', { waves: 4, frequency: 12, amplitude: 40, lines: 25, strokeWidth: 0.4, color: `${primary}30`, phase: 0, damping: 0.3 } as GuillocheConfig),
      makeLayer('watermark-pattern', 'Watermark', { text: 'BOND CERTIFICATE', fontFamily: 'Space Grotesk', fontSize: 10, color: `${primary}06`, angle: -30, spacingX: 200, spacingY: 80 } as WatermarkPatternConfig),
      makeLayer('text', 'Header', { text: 'BOND CERTIFICATE', fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700, color: accent, letterSpacing: 8, align: 'center', x: 0.5, y: 0.06 } as TextLayerConfig),
      makeLayer('text', 'Issuer', { text: 'ISSUER NAME', fontFamily: 'Bebas Neue', fontSize: 48, fontWeight: 700, color: text, letterSpacing: 4, align: 'center', x: 0.5, y: 0.12 } as TextLayerConfig),
      makeLayer('text', 'Bond Type', { text: label.toUpperCase(), fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 600, color: accent, letterSpacing: 6, align: 'center', x: 0.5, y: 0.17 } as TextLayerConfig),
      makeLayer('text', 'Face Value', { text: '$10,000', fontFamily: 'Bebas Neue', fontSize: 72, fontWeight: 700, color: text, letterSpacing: 2, align: 'center', x: 0.5, y: 0.28 } as TextLayerConfig),
      makeLayer('text', 'Face Label', { text: 'FACE VALUE', fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 600, color: `${text}60`, letterSpacing: 4, align: 'center', x: 0.5, y: 0.33 } as TextLayerConfig),
      ...(!isZeroCoupon ? [
        makeLayer('text', 'Coupon Rate', { text: '5.25%', fontFamily: 'Bebas Neue', fontSize: 36, fontWeight: 700, color: accent, letterSpacing: 2, align: 'center', x: 0.3, y: 0.42 } as TextLayerConfig),
        makeLayer('text', 'Coupon Label', { text: 'COUPON RATE', fontFamily: 'Space Grotesk', fontSize: 8, fontWeight: 600, color: `${text}50`, letterSpacing: 3, align: 'center', x: 0.3, y: 0.46 } as TextLayerConfig),
      ] : []),
      makeLayer('text', 'Maturity', { text: '2036-01-01', fontFamily: 'IBM Plex Mono', fontSize: 24, fontWeight: 500, color: accent, letterSpacing: 2, align: 'center', x: 0.7, y: 0.42 } as TextLayerConfig),
      makeLayer('text', 'Maturity Label', { text: 'MATURITY DATE', fontFamily: 'Space Grotesk', fontSize: 8, fontWeight: 600, color: `${text}50`, letterSpacing: 3, align: 'center', x: 0.7, y: 0.46 } as TextLayerConfig),
      makeLayer('text', 'Frequency', { text: `Payment: ${isZeroCoupon ? 'At Maturity' : 'Semi-Annual'}`, fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 400, color: `${text}50`, letterSpacing: 2, align: 'center', x: 0.5, y: 0.52 } as TextLayerConfig),
      makeLayer('text', 'Holder Label', { text: 'REGISTERED HOLDER', fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 600, color: `${text}40`, letterSpacing: 4, align: 'center', x: 0.5, y: 0.60 } as TextLayerConfig),
      makeLayer('text', 'Holder Name', { text: '_______________________________', fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 400, color: `${text}30`, letterSpacing: 0, align: 'center', x: 0.5, y: 0.65 } as TextLayerConfig),
      makeLayer('rosette', 'Seal', { petals: 16, rings: 8, radius: 0.06, strokeWidth: 0.3, color: primary, rotation: 0, innerRadius: 0.3 } as RosetteConfig),
      makeLayer('microprint', 'Microprint', { text: 'BOND CERTIFICATE AUTHENTIC VERIFIED', fontSize: 2, color: `${primary}15`, rows: 8, angle: 0, spacing: 4 } as MicroprintConfig),
      makeLayer('serial-number', 'Certificate No.', { prefix: 'BD', startNumber: 1, digits: 6, fontFamily: 'IBM Plex Mono', fontSize: 14, color: primary, letterSpacing: 3, x: 0.85, y: 0.94 } as SerialNumberConfig),
    ],
    circleMask: false,
    rimPattern: defaultRimPattern(),
    certificateMetadata: { kind: 'bond', data: { ...defaultBondMetadata(), bondType } },
  };
}

export type BondTemplate = {
  id: string;
  name: string;
  description: string;
  factory: () => MintDocument;
};

export const BOND_TEMPLATES: BondTemplate[] = [
  { id: 'government', name: 'Government Bond', description: 'Sovereign debt', factory: () => bondCertDoc('Government Bond', 'government', '#0a0a1a', '#1565c0', '#42a5f5', '#e3f2fd') },
  { id: 'corporate', name: 'Corporate Bond', description: 'Company-issued debt', factory: () => bondCertDoc('Corporate Bond', 'corporate', '#060012', '#c9a84c', '#e6c665', '#fff8dc') },
  { id: 'municipal', name: 'Municipal Bond', description: 'Local government', factory: () => bondCertDoc('Municipal Bond', 'municipal', '#0a1a0a', '#2d8f4e', '#4caf50', '#d4e8d0') },
  { id: 'zero-coupon', name: 'Zero-Coupon Bond', description: 'Discount bond', factory: () => bondCertDoc('Zero-Coupon Bond', 'zero-coupon', '#0a0a0a', '#808080', '#c0c0c0', '#f5f5f5') },
  { id: 'convertible', name: 'Convertible Bond', description: 'Equity conversion', factory: () => bondCertDoc('Convertible Bond', 'convertible', '#1a0a1a', '#7b1fa2', '#ab47bc', '#f3e5f5') },
  { id: 'bearer', name: 'Bearer Bond', description: 'Payable to holder', factory: () => bondCertDoc('Bearer Bond', 'bearer', '#1a0f0a', '#f7931a', '#ff9800', '#fff3e0') },
  { id: 'savings', name: 'Savings Bond', description: 'Low-risk savings', factory: () => bondCertDoc('Savings Bond', 'savings', '#0a1a2a', '#0d47a1', '#1976d2', '#e3f2fd') },
  { id: 'green', name: 'Green Bond', description: 'Environmental projects', factory: () => bondCertDoc('Green Bond', 'green', '#0a1a0a', '#1b5e20', '#4caf50', '#e8f5e9') },
];
