import type { TextOverlay } from './types';
import { createDefaultTextOverlay } from './defaults';

export type CoverTemplate = {
  id: string;
  name: string;
  description: string;
  factory: (title?: string, subtitle?: string, issueNum?: string) => TextOverlay[];
};

export const coverTemplates: CoverTemplate[] = [
  {
    id: 'magazine-classic',
    name: 'Magazine Classic',
    description: 'Large title top-center, subtitle below, issue # bottom-right',
    factory: (title = 'TITLE', subtitle = 'Subtitle', issueNum = '#001') => [
      createDefaultTextOverlay({
        text: title,
        fontFamily: 'Bebas Neue',
        fontSize: 96,
        fontWeight: 400,
        color: '#ffffff',
        align: 'center',
        x: 0.5,
        y: 0.15,
        width: 0.8,
        letterSpacing: 6,
      }),
      createDefaultTextOverlay({
        text: subtitle,
        fontFamily: 'Space Grotesk',
        fontSize: 28,
        fontWeight: 400,
        color: '#ff69b4',
        align: 'center',
        x: 0.5,
        y: 0.25,
        width: 0.6,
        letterSpacing: 4,
      }),
      createDefaultTextOverlay({
        text: issueNum,
        fontFamily: 'IBM Plex Mono',
        fontSize: 18,
        fontWeight: 500,
        color: '#ffffff',
        align: 'right',
        x: 0.88,
        y: 0.92,
        width: 0.2,
        letterSpacing: 2,
        opacity: 0.7,
      }),
    ],
  },
  {
    id: 'bold-title',
    name: 'Bold Title',
    description: 'Massive centered title with thin subtitle line below',
    factory: (title = 'TITLE', subtitle = 'Subtitle') => [
      createDefaultTextOverlay({
        text: title,
        fontFamily: 'Bebas Neue',
        fontSize: 140,
        fontWeight: 400,
        color: '#ffffff',
        align: 'center',
        x: 0.5,
        y: 0.45,
        width: 0.9,
        letterSpacing: 10,
      }),
      createDefaultTextOverlay({
        text: subtitle,
        fontFamily: 'Space Grotesk',
        fontSize: 20,
        fontWeight: 400,
        color: '#e91e8c',
        align: 'center',
        x: 0.5,
        y: 0.58,
        width: 0.5,
        letterSpacing: 6,
        opacity: 0.8,
      }),
    ],
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'Title top-left aligned, subtitle bottom-left',
    factory: (title = 'TITLE', subtitle = 'Subtitle', issueNum = '#001') => [
      createDefaultTextOverlay({
        text: title,
        fontFamily: 'Oswald',
        fontSize: 72,
        fontWeight: 600,
        color: '#ffffff',
        align: 'left',
        x: 0.12,
        y: 0.12,
        width: 0.7,
        letterSpacing: 3,
      }),
      createDefaultTextOverlay({
        text: `${subtitle}  ${issueNum}`,
        fontFamily: 'Space Grotesk',
        fontSize: 16,
        fontWeight: 500,
        color: '#ffffff',
        align: 'left',
        x: 0.12,
        y: 0.88,
        width: 0.5,
        letterSpacing: 3,
        opacity: 0.6,
      }),
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Small title bottom-center only',
    factory: (title = 'TITLE') => [
      createDefaultTextOverlay({
        text: title,
        fontFamily: 'Space Grotesk',
        fontSize: 24,
        fontWeight: 600,
        color: '#ffffff',
        align: 'center',
        x: 0.5,
        y: 0.9,
        width: 0.4,
        letterSpacing: 8,
        opacity: 0.75,
      }),
    ],
  },
];
