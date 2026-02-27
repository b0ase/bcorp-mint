// ---------------------------------------------------------------------------
// Pure-TypeScript QR Code Encoder
// Versions 1–10, byte mode, Reed-Solomon over GF(256), 8 mask patterns
// Zero dependencies — works in browser + Electron + Node
// ---------------------------------------------------------------------------

import type { QRErrorCorrection } from './qr-types';

// --- GF(256) arithmetic ---------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x << 1;
    if (x & 0x100) x ^= 0x11d; // primitive polynomial for GF(256)
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function gfPolyMul(a: number[], b: number[]): number[] {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return result;
}

function gfPolyDiv(dividend: number[], divisor: number[]): number[] {
  const result = [...dividend];
  for (let i = 0; i < dividend.length - divisor.length + 1; i++) {
    if (result[i] === 0) continue;
    const coef = result[i];
    for (let j = 1; j < divisor.length; j++) {
      result[i + j] ^= gfMul(divisor[j], coef);
    }
  }
  return result.slice(dividend.length - divisor.length + 1);
}

function rsGeneratorPoly(numSymbols: number): number[] {
  let gen = [1];
  for (let i = 0; i < numSymbols; i++) {
    gen = gfPolyMul(gen, [1, GF_EXP[i]]);
  }
  return gen;
}

function rsEncode(data: number[], numEcc: number): number[] {
  const gen = rsGeneratorPoly(numEcc);
  const padded = [...data, ...new Array(numEcc).fill(0)];
  const remainder = gfPolyDiv(padded, gen);
  return [...data, ...remainder];
}

// --- Version / capacity tables --------------------------------------------

const EC_LEVELS: Record<QRErrorCorrection, number> = { L: 0, M: 1, Q: 2, H: 3 };

// [version][ecLevel] = { totalCodewords, ecPerBlock, numBlocks }
type ECInfo = { total: number; ecPer: number; blocks: number; blocks2?: number; dataPerBlock2?: number };

// Capacity data for versions 1–10 (byte mode capacity)
const VERSION_CAPACITY: number[][] = [
  // [L, M, Q, H] — max byte-mode characters
  [17, 14, 11, 7],       // v1
  [32, 26, 20, 14],      // v2
  [53, 42, 32, 24],      // v3
  [78, 62, 46, 34],      // v4
  [106, 84, 60, 44],     // v5
  [134, 106, 74, 58],    // v6
  [154, 122, 86, 64],    // v7
  [192, 152, 108, 84],   // v8
  [230, 180, 130, 98],   // v9
  [271, 213, 151, 119],  // v10
];

// EC codewords per block and block structure for versions 1–10
const EC_TABLE: ECInfo[][] = [
  // v1
  [{ total: 26, ecPer: 7, blocks: 1 }, { total: 26, ecPer: 10, blocks: 1 }, { total: 26, ecPer: 13, blocks: 1 }, { total: 26, ecPer: 17, blocks: 1 }],
  // v2
  [{ total: 44, ecPer: 10, blocks: 1 }, { total: 44, ecPer: 16, blocks: 1 }, { total: 44, ecPer: 22, blocks: 1 }, { total: 44, ecPer: 28, blocks: 1 }],
  // v3
  [{ total: 70, ecPer: 15, blocks: 1 }, { total: 70, ecPer: 26, blocks: 1 }, { total: 70, ecPer: 18, blocks: 2 }, { total: 70, ecPer: 22, blocks: 2 }],
  // v4
  [{ total: 100, ecPer: 20, blocks: 1 }, { total: 100, ecPer: 18, blocks: 2 }, { total: 100, ecPer: 26, blocks: 2 }, { total: 100, ecPer: 16, blocks: 4 }],
  // v5
  [{ total: 134, ecPer: 26, blocks: 1 }, { total: 134, ecPer: 24, blocks: 2 }, { total: 134, ecPer: 18, blocks: 2, blocks2: 2, dataPerBlock2: 16 }, { total: 134, ecPer: 22, blocks: 2, blocks2: 2, dataPerBlock2: 12 }],
  // v6
  [{ total: 172, ecPer: 18, blocks: 2 }, { total: 172, ecPer: 16, blocks: 4 }, { total: 172, ecPer: 24, blocks: 2, blocks2: 2, dataPerBlock2: 15 }, { total: 172, ecPer: 28, blocks: 4, blocks2: 1, dataPerBlock2: 12 }],
  // v7
  [{ total: 196, ecPer: 20, blocks: 2 }, { total: 196, ecPer: 18, blocks: 4 }, { total: 196, ecPer: 18, blocks: 2, blocks2: 4, dataPerBlock2: 14 }, { total: 196, ecPer: 26, blocks: 4, blocks2: 1, dataPerBlock2: 13 }],
  // v8
  [{ total: 242, ecPer: 24, blocks: 2 }, { total: 242, ecPer: 22, blocks: 2, blocks2: 2, dataPerBlock2: 31 }, { total: 242, ecPer: 22, blocks: 4, blocks2: 2, dataPerBlock2: 15 }, { total: 242, ecPer: 26, blocks: 4, blocks2: 2, dataPerBlock2: 13 }],
  // v9
  [{ total: 292, ecPer: 30, blocks: 2 }, { total: 292, ecPer: 22, blocks: 3, blocks2: 2, dataPerBlock2: 25 }, { total: 292, ecPer: 20, blocks: 4, blocks2: 4, dataPerBlock2: 14 }, { total: 292, ecPer: 24, blocks: 4, blocks2: 4, dataPerBlock2: 12 }],
  // v10
  [{ total: 346, ecPer: 18, blocks: 2, blocks2: 2, dataPerBlock2: 43 }, { total: 346, ecPer: 26, blocks: 4, blocks2: 1, dataPerBlock2: 29 }, { total: 346, ecPer: 24, blocks: 6, blocks2: 2, dataPerBlock2: 15 }, { total: 346, ecPer: 28, blocks: 6, blocks2: 2, dataPerBlock2: 12 }],
];

// Alignment pattern locations per version (empty for v1)
const ALIGNMENT_POSITIONS: number[][] = [
  [],        // v1
  [6, 18],   // v2
  [6, 22],   // v3
  [6, 26],   // v4
  [6, 30],   // v5
  [6, 34],   // v6
  [6, 22, 38], // v7
  [6, 24, 42], // v8
  [6, 26, 46], // v9
  [6, 28, 52], // v10
];

// --- Encoding --------------------------------------------------------------

function selectVersion(dataLen: number, ecLevel: QRErrorCorrection): number {
  const ecIdx = EC_LEVELS[ecLevel];
  for (let v = 0; v < VERSION_CAPACITY.length; v++) {
    if (VERSION_CAPACITY[v][ecIdx] >= dataLen) return v + 1;
  }
  return 10; // max supported — will truncate
}

function encodeData(text: string, version: number, ecLevel: QRErrorCorrection): number[] {
  const ecIdx = EC_LEVELS[ecLevel];
  const ecInfo = EC_TABLE[version - 1][ecIdx];
  const totalDataCodewords = ecInfo.total - ecInfo.ecPer * ecInfo.blocks - (ecInfo.blocks2 ? ecInfo.ecPer * ecInfo.blocks2 : 0);

  // Byte mode indicator (0100) + character count
  const bytes = new TextEncoder().encode(text);
  const bits: number[] = [];

  // Mode indicator: 0100 (byte)
  bits.push(0, 1, 0, 0);

  // Character count — 8 bits for v1–9, 16 bits for v10+
  const countBits = version <= 9 ? 8 : 16;
  for (let i = countBits - 1; i >= 0; i--) {
    bits.push((bytes.length >> i) & 1);
  }

  // Data
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1);
    }
  }

  // Terminator (up to 4 bits)
  const maxBits = totalDataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    dataBytes.push(byte);
  }

  // Pad with alternating 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < totalDataCodewords) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Split into blocks and apply RS encoding
  const numBlocks1 = ecInfo.blocks;
  const numBlocks2 = ecInfo.blocks2 || 0;
  const totalBlocks = numBlocks1 + numBlocks2;
  const dataPerBlock1 = Math.floor(totalDataCodewords / totalBlocks);
  const dataPerBlock2 = ecInfo.dataPerBlock2 || dataPerBlock1;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;

  for (let b = 0; b < numBlocks1; b++) {
    const blockData = dataBytes.slice(offset, offset + dataPerBlock1);
    offset += dataPerBlock1;
    const encoded = rsEncode(blockData, ecInfo.ecPer);
    dataBlocks.push(blockData);
    ecBlocks.push(encoded.slice(blockData.length));
  }

  for (let b = 0; b < numBlocks2; b++) {
    const blockData = dataBytes.slice(offset, offset + dataPerBlock2);
    offset += dataPerBlock2;
    const encoded = rsEncode(blockData, ecInfo.ecPer);
    dataBlocks.push(blockData);
    ecBlocks.push(encoded.slice(blockData.length));
  }

  // Interleave data codewords
  const interleaved: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }

  // Interleave EC codewords
  const maxEcLen = Math.max(...ecBlocks.map(b => b.length));
  for (let i = 0; i < maxEcLen; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }

  return interleaved;
}

// --- Module placement ------------------------------------------------------

function moduleSize(version: number): number {
  return 17 + version * 4;
}

type Matrix = boolean[][];
type Reserved = boolean[][];

function createMatrix(size: number): { matrix: Matrix; reserved: Reserved } {
  const matrix: Matrix = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved: Reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  return { matrix, reserved };
}

function placeFinderPattern(matrix: Matrix, reserved: Reserved, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const mr = row + r;
      const mc = col + c;
      if (mr < 0 || mr >= matrix.length || mc < 0 || mc >= matrix.length) continue;
      reserved[mr][mc] = true;
      if (r === -1 || r === 7 || c === -1 || c === 7) {
        matrix[mr][mc] = false; // separator
      } else if (r === 0 || r === 6 || c === 0 || c === 6) {
        matrix[mr][mc] = true;
      } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
        matrix[mr][mc] = true;
      } else {
        matrix[mr][mc] = false;
      }
    }
  }
}

function placeAlignmentPattern(matrix: Matrix, reserved: Reserved, row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const mr = row + r;
      const mc = col + c;
      if (mr < 0 || mr >= matrix.length || mc < 0 || mc >= matrix.length) continue;
      if (reserved[mr][mc]) return; // overlaps finder
    }
  }
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const mr = row + r;
      const mc = col + c;
      reserved[mr][mc] = true;
      if (Math.abs(r) === 2 || Math.abs(c) === 2) {
        matrix[mr][mc] = true;
      } else if (r === 0 && c === 0) {
        matrix[mr][mc] = true;
      } else {
        matrix[mr][mc] = false;
      }
    }
  }
}

function placeTimingPatterns(matrix: Matrix, reserved: Reserved) {
  const size = matrix.length;
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      matrix[6][i] = i % 2 === 0;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      matrix[i][6] = i % 2 === 0;
      reserved[i][6] = true;
    }
  }
}

function reserveFormatInfo(reserved: Reserved) {
  const size = reserved.length;
  // Around top-left finder
  for (let i = 0; i <= 8; i++) {
    if (i < size) reserved[8][i] = true;
    if (i < size) reserved[i][8] = true;
  }
  // Bottom-left
  for (let i = 0; i < 7; i++) {
    reserved[size - 1 - i][8] = true;
  }
  // Top-right
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
  }
  // Dark module
  reserved[size - 8][8] = true;
}

function reserveVersionInfo(reserved: Reserved, version: number) {
  if (version < 7) return;
  const size = reserved.length;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      reserved[i][size - 11 + j] = true;
      reserved[size - 11 + j][i] = true;
    }
  }
}

function placeDataBits(matrix: Matrix, reserved: Reserved, dataBits: number[]) {
  const size = matrix.length;
  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // skip vertical timing
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (cc < 0 || reserved[row][cc]) continue;
        matrix[row][cc] = bitIdx < dataBits.length ? dataBits[bitIdx] === 1 : false;
        bitIdx++;
      }
    }
    upward = !upward;
  }
}

// --- Masking ---------------------------------------------------------------

type MaskFn = (row: number, col: number) => boolean;

const MASK_FUNCTIONS: MaskFn[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(matrix: Matrix, reserved: Reserved, maskIdx: number): Matrix {
  const size = matrix.length;
  const masked = matrix.map(row => [...row]);
  const fn = MASK_FUNCTIONS[maskIdx];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && fn(r, c)) {
        masked[r][c] = !masked[r][c];
      }
    }
  }
  return masked;
}

// --- Format / Version info --------------------------------------------------

const FORMAT_INFO_STRINGS: number[][] = (() => {
  // Pre-computed 15-bit format info for each (EC level, mask) combo
  // Format: ecLevel(2 bits) + mask(3 bits) + BCH(10 bits) XOR 0x5412
  const GENERATOR = 0x537;
  const MASK_PATTERN = 0x5412;
  const results: number[][] = [];

  const ecBits = [1, 0, 3, 2]; // L=01, M=00, Q=11, H=10

  for (let ec = 0; ec < 4; ec++) {
    const row: number[] = [];
    for (let mask = 0; mask < 8; mask++) {
      let data = (ecBits[ec] << 3) | mask;
      let bits = data << 10;
      for (let i = 4; i >= 0; i--) {
        if (bits & (1 << (i + 10))) {
          bits ^= GENERATOR << i;
        }
      }
      const formatted = ((data << 10) | bits) ^ MASK_PATTERN;
      row.push(formatted);
    }
    results.push(row);
  }
  return results;
})();

function placeFormatInfo(matrix: Matrix, ecLevel: QRErrorCorrection, maskIdx: number) {
  const size = matrix.length;
  const ecIdx = EC_LEVELS[ecLevel];
  const info = FORMAT_INFO_STRINGS[ecIdx][maskIdx];

  // Horizontal strip next to top-left finder
  const hPositions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (info >> i) & 1;
    const [r, c] = hPositions[i];
    matrix[r][c] = bit === 1;
  }

  // Vertical/horizontal around other finders
  const vPositions = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (info >> i) & 1;
    const [r, c] = vPositions[i];
    matrix[r][c] = bit === 1;
  }

  // Dark module
  matrix[size - 8][8] = true;
}

// --- Penalty scoring -------------------------------------------------------

function penaltyScore(matrix: Matrix): number {
  const size = matrix.length;
  let score = 0;

  // Rule 1: runs of same color
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        count++;
      } else {
        if (count >= 5) score += count - 2;
        count = 1;
      }
    }
    if (count >= 5) score += count - 2;
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        count++;
      } else {
        if (count >= 5) score += count - 2;
        count = 1;
      }
    }
    if (count >= 5) score += count - 2;
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 3: finder-like patterns
  const pattern1 = [true, false, true, true, true, false, true, false, false, false, false];
  const pattern2 = [...pattern1].reverse();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      let match1 = true, match2 = true;
      for (let i = 0; i < 11; i++) {
        if (matrix[r][c + i] !== pattern1[i]) match1 = false;
        if (matrix[r][c + i] !== pattern2[i]) match2 = false;
      }
      if (match1 || match2) score += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - 11; r++) {
      let match1 = true, match2 = true;
      for (let i = 0; i < 11; i++) {
        if (matrix[r + i][c] !== pattern1[i]) match1 = false;
        if (matrix[r + i][c] !== pattern2[i]) match2 = false;
      }
      if (match1 || match2) score += 40;
    }
  }

  // Rule 4: proportion of dark modules
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) dark++;
    }
  }
  const total = size * size;
  const pct = (dark / total) * 100;
  const prev5 = Math.floor(pct / 5) * 5;
  const next5 = prev5 + 5;
  score += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

  return score;
}

// --- Public API -------------------------------------------------------------

export type QRMatrix = boolean[][];

export function encodeQR(text: string, ecLevel: QRErrorCorrection = 'M'): { matrix: QRMatrix; version: number } {
  if (!text) {
    // Return a minimal empty v1 QR
    const size = moduleSize(1);
    return {
      matrix: Array.from({ length: size }, () => new Array(size).fill(false)),
      version: 1,
    };
  }

  const textBytes = new TextEncoder().encode(text);
  const version = selectVersion(textBytes.length, ecLevel);
  const size = moduleSize(version);

  // Encode data + EC
  const codewords = encodeData(text, version, ecLevel);
  const dataBits = codewords.flatMap(byte => {
    const bits: number[] = [];
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    return bits;
  });

  // Create matrix and place fixed patterns
  const { matrix, reserved } = createMatrix(size);

  // Finder patterns
  placeFinderPattern(matrix, reserved, 0, 0);
  placeFinderPattern(matrix, reserved, 0, size - 7);
  placeFinderPattern(matrix, reserved, size - 7, 0);

  // Alignment patterns
  const positions = ALIGNMENT_POSITIONS[version - 1];
  if (positions.length > 0) {
    for (const r of positions) {
      for (const c of positions) {
        placeAlignmentPattern(matrix, reserved, r, c);
      }
    }
  }

  // Timing patterns
  placeTimingPatterns(matrix, reserved);

  // Reserve format + version info areas
  reserveFormatInfo(reserved);
  reserveVersionInfo(reserved, version);

  // Place data
  placeDataBits(matrix, reserved, dataBits);

  // Try all 8 masks, pick lowest penalty
  let bestMask = 0;
  let bestScore = Infinity;
  let bestMatrix = matrix;

  for (let m = 0; m < 8; m++) {
    const masked = applyMask(matrix, reserved, m);
    placeFormatInfo(masked, ecLevel, m);
    const s = penaltyScore(masked);
    if (s < bestScore) {
      bestScore = s;
      bestMask = m;
      bestMatrix = masked;
    }
  }

  // Apply best mask to original and write format info
  const finalMatrix = applyMask(matrix, reserved, bestMask);
  placeFormatInfo(finalMatrix, ecLevel, bestMask);

  return { matrix: finalMatrix, version };
}

export function getQRVersion(text: string, ecLevel: QRErrorCorrection = 'M'): number {
  if (!text) return 1;
  const textBytes = new TextEncoder().encode(text);
  return selectVersion(textBytes.length, ecLevel);
}
