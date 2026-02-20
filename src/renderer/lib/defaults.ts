import type { ImageSettings } from './types';

export const createDefaultSettings = (logoId: string): ImageSettings => ({
  logoId,
  logoScale: 0.18,
  logoPos: { x: 0.82, y: 0.86 },
  vignetteEnabled: true,
  vignetteStrength: 0.35,
  frameEnabled: true,
  frameThickness: 0.035,
  frameColor: '#f5f5f5',
  stampVisual: {
    watermarkEnabled: false,
    watermarkText: 'MINT',
    watermarkOpacity: 0.15,
    watermarkPosition: 'diagonal',
    borderStampEnabled: false,
    borderStampText: ''
  }
});
