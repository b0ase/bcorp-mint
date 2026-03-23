import type { ImageSettings, TextOverlay } from './types';

export const createDefaultTextOverlay = (partial?: Partial<TextOverlay>): TextOverlay => ({
  id: crypto.randomUUID(),
  text: 'Text',
  fontFamily: 'Space Grotesk',
  fontSize: 48,
  fontWeight: 700,
  color: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  letterSpacing: 2,
  lineHeight: 1.2,
  align: 'center',
  x: 0.5,
  y: 0.5,
  width: 0.6,
  rotation: 0,
  opacity: 1,
  visible: true,
  ...partial
});

export const createDefaultSettings = (logoId: string): ImageSettings => ({
  logoId,
  logoScale: 0.35,
  logoPos: { x: 0.5, y: 0.12 },
  vignetteEnabled: true,
  vignetteStrength: 0.35,
  frameEnabled: true,
  frameThickness: 0.035,
  frameColor: '#f5f5f5',
  stampVisual: {
    watermarkEnabled: false,
    watermarkText: '',
    watermarkOpacity: 0.15,
    watermarkPosition: 'diagonal',
    borderStampEnabled: false,
    borderStampText: ''
  },
  textOverlays: []
});
