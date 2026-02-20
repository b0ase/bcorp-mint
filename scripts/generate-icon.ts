/**
 * Generate app icon for The Bitcoin Corporation Mint
 * Run: npx tsx scripts/generate-icon.ts
 * Produces: resources/icon.png (1024x1024)
 * Then use iconutil or png2icns to convert
 */

// We'll generate an SVG and use it as the basis
// The icon: a gold coin/seal with "M" in the center, guilloche-style rings

const size = 1024;
const cx = size / 2;
const cy = size / 2;

function guillocheRing(r: number, waves: number, amp: number, strokeWidth: number, color: string, opacity: number): string {
  const points: string[] = [];
  const steps = 720;
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    const radius = r + amp * Math.sin(waves * theta);
    const x = cx + radius * Math.cos(theta);
    const y = cy + radius * Math.sin(theta);
    points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  return `<path d="${points.join(' ')} Z" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

const bg = `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="#0a0800"/>`;
const outerRim = `<circle cx="${cx}" cy="${cy}" r="${size / 2 - 20}" fill="none" stroke="#c9a84c" stroke-width="40" opacity="0.3"/>`;
const innerRim = `<circle cx="${cx}" cy="${cy}" r="${size / 2 - 60}" fill="none" stroke="#c9a84c" stroke-width="2" opacity="0.5"/>`;

// Guilloche rings
const rings: string[] = [];
for (let i = 0; i < 8; i++) {
  const r = 120 + i * 35;
  const waves = 12 + i * 2;
  const amp = 8 + i * 2;
  const opacity = 0.15 + (i / 8) * 0.25;
  rings.push(guillocheRing(r, waves, amp, 1.5, '#c9a84c', opacity));
}

// Central "M" letter
const letterM = `
  <text x="${cx}" y="${cy + 60}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="380" font-weight="bold" fill="#c9a84c" letter-spacing="-10">M</text>
`;

// Subtle inner glow
const glow = `
  <radialGradient id="glow">
    <stop offset="0%" stop-color="#c9a84c" stop-opacity="0.15"/>
    <stop offset="60%" stop-color="#c9a84c" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
  </radialGradient>
  <circle cx="${cx}" cy="${cy}" r="200" fill="url(#glow)"/>
`;

// Small text around the inner rim
const textPath = `
  <defs>
    <path id="textCircle" d="M ${cx - 380} ${cy} a 380 380 0 1 1 760 0 a 380 380 0 1 1 -760 0"/>
    ${glow.includes('radialGradient') ? '' : glow}
  </defs>
  <text fill="#c9a84c" opacity="0.4" font-family="Georgia, serif" font-size="22" letter-spacing="8">
    <textPath href="#textCircle">THE BITCOIN CORPORATION ★ THE BITCOIN CORPORATION ★ THE BITCOIN CORPORATION ★</textPath>
  </text>
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="#c9a84c" stop-opacity="0.15"/>
      <stop offset="60%" stop-color="#c9a84c" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#c9a84c" stop-opacity="0"/>
    </radialGradient>
    <path id="textCircle" d="M ${cx - 380} ${cy} a 380 380 0 1 1 760 0 a 380 380 0 1 1 -760 0"/>
  </defs>
  ${bg}
  ${outerRim}
  ${innerRim}
  ${rings.join('\n  ')}
  <circle cx="${cx}" cy="${cy}" r="200" fill="url(#glow)"/>
  <text fill="#c9a84c" opacity="0.4" font-family="Georgia, serif" font-size="22" letter-spacing="8">
    <textPath href="#textCircle">THE BITCOIN CORPORATION ★ THE BITCOIN CORPORATION ★ THE BITCOIN CORPORATION ★</textPath>
  </text>
  ${letterM}
</svg>`;

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname2 = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname2, '..', 'resources', 'icon.svg');
writeFileSync(outPath, svg);
console.log(`Written SVG icon to ${outPath}`);
console.log('Convert to PNG: sips -s format png -z 1024 1024 resources/icon.svg --out resources/icon.png');
