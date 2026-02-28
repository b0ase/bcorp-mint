import type { Clef, KeySignature, Measure, MusicNote, MusicScore, NoteDuration, Pitch, Staff, TimeSignature } from './music-types';
import { FLAT_ORDER, KEY_SIGNATURE_ACCIDENTALS, NOTE_NAMES, SHARP_ORDER } from './music-types';

// ─── Layout Constants ───────────────────────────────────────────

const STAFF_LINE_SPACING = 10;  // pixels between staff lines
const STAFF_HEIGHT = STAFF_LINE_SPACING * 4; // 5 lines = 4 gaps
const STAFF_TOP_MARGIN = 80;
const STAFF_BOTTOM_MARGIN = 40;
const STAFF_LEFT_MARGIN = 60;
const STAFF_RIGHT_MARGIN = 30;
const CLEF_WIDTH = 40;
const KEY_SIG_WIDTH_PER = 12;
const TIME_SIG_WIDTH = 30;
const MEASURE_MIN_WIDTH = 120;
const NOTE_HEAD_RX = 5;
const NOTE_HEAD_RY = 3.5;
const STEM_LENGTH = 30;
const STAFF_GAP = 80; // gap between staves

// ─── SVG Paths (simplified music glyphs) ────────────────────────

const TREBLE_CLEF_PATH = `M 8 40 C 8 28 16 20 16 10 C 16 4 12 0 8 0 C 4 0 0 4 0 10 C 0 16 4 18 8 18 C 12 18 16 16 16 10 C 16 20 8 28 8 40 C 8 48 12 54 16 54 C 18 54 20 52 20 48 C 20 44 16 42 14 42`;
const BASS_CLEF_PATH = `M 0 10 C 0 4 4 0 10 0 C 14 0 18 4 18 8 C 18 14 12 18 8 18 L 0 28 M 22 6 L 24 6 M 22 14 L 24 14`;

function trebleClefSvg(x: number, y: number): string {
  return `<g transform="translate(${x},${y - 27}) scale(0.7)"><path d="${TREBLE_CLEF_PATH}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></g>`;
}

function bassClefSvg(x: number, y: number): string {
  return `<g transform="translate(${x},${y - 14}) scale(0.8)"><path d="${BASS_CLEF_PATH}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="22" cy="6" r="2" fill="currentColor"/><circle cx="22" cy="14" r="2" fill="currentColor"/></g>`;
}

function altoClefSvg(x: number, y: number): string {
  const top = y - STAFF_HEIGHT / 2;
  return `<g>
    <line x1="${x}" y1="${top}" x2="${x}" y2="${top + STAFF_HEIGHT}" stroke="currentColor" stroke-width="3"/>
    <line x1="${x + 4}" y1="${top}" x2="${x + 4}" y2="${top + STAFF_HEIGHT}" stroke="currentColor" stroke-width="1.5"/>
    <line x1="${x + 8}" y1="${top + STAFF_HEIGHT * 0.15}" x2="${x + 20}" y2="${top + STAFF_HEIGHT / 2}" stroke="currentColor" stroke-width="1.5"/>
    <line x1="${x + 8}" y1="${top + STAFF_HEIGHT * 0.85}" x2="${x + 20}" y2="${top + STAFF_HEIGHT / 2}" stroke="currentColor" stroke-width="1.5"/>
  </g>`;
}

function clefSvg(clef: Clef, x: number, staffCenterY: number): string {
  switch (clef) {
    case 'treble': return trebleClefSvg(x, staffCenterY);
    case 'bass': return bassClefSvg(x, staffCenterY);
    case 'alto':
    case 'tenor': return altoClefSvg(x, staffCenterY);
  }
}

// ─── Pitch → Y Position ────────────────────────────────────────

/** Middle line of staff for each clef (MIDI-style: C4 = 60) */
function clefMiddleNote(clef: Clef): number {
  switch (clef) {
    case 'treble': return 71; // B4
    case 'bass':   return 50; // D3
    case 'alto':   return 60; // C4
    case 'tenor':  return 57; // A3
  }
}

function pitchToMidi(pitch: Pitch): number {
  const noteIndex = NOTE_NAMES.indexOf(pitch.note);
  return (pitch.octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][noteIndex]
    + (pitch.accidental === 'sharp' ? 1 : pitch.accidental === 'flat' ? -1 : 0);
}

/** Convert pitch to staff position (0 = middle line, positive = up) in half-spaces */
function pitchToStaffPosition(pitch: Pitch, clef: Clef): number {
  const noteIndex = NOTE_NAMES.indexOf(pitch.note);
  const diatonicValue = pitch.octave * 7 + noteIndex;
  // Middle line diatonic values for each clef
  const middleDiatonic = (() => {
    switch (clef) {
      case 'treble': return 4 * 7 + 6; // B4 = 34
      case 'bass':   return 2 * 7 + 3; // D3 (actually, middle line of bass = D3)
      case 'alto':   return 3 * 7 + 0; // C4 = 21
      case 'tenor':  return 2 * 7 + 5; // A3
    }
  })();
  return diatonicValue - middleDiatonic;
}

function staffPositionToY(position: number, staffTopY: number): number {
  const middleY = staffTopY + STAFF_HEIGHT / 2;
  return middleY - position * (STAFF_LINE_SPACING / 2);
}

// ─── Note Rendering ─────────────────────────────────────────────

function noteHeadSvg(x: number, y: number, filled: boolean, selected: boolean): string {
  const color = selected ? '#ff2d78' : 'currentColor';
  return `<ellipse cx="${x}" cy="${y}" rx="${NOTE_HEAD_RX}" ry="${NOTE_HEAD_RY}" fill="${filled ? color : 'none'}" stroke="${color}" stroke-width="1.2" transform="rotate(-10,${x},${y})"/>`;
}

function stemSvg(x: number, noteY: number, up: boolean): string {
  const stemX = up ? x + NOTE_HEAD_RX - 1 : x - NOTE_HEAD_RX + 1;
  const stemEndY = up ? noteY - STEM_LENGTH : noteY + STEM_LENGTH;
  return `<line x1="${stemX}" y1="${noteY}" x2="${stemX}" y2="${stemEndY}" stroke="currentColor" stroke-width="1.2"/>`;
}

function flagSvg(x: number, noteY: number, up: boolean, count: number): string {
  if (count <= 0) return '';
  const stemX = up ? x + NOTE_HEAD_RX - 1 : x - NOTE_HEAD_RX + 1;
  const flagDir = up ? -1 : 1;
  let svg = '';
  for (let i = 0; i < count; i++) {
    const fy = noteY + flagDir * (STEM_LENGTH - i * 6);
    const cp1y = fy + flagDir * -12;
    const cp2y = fy + flagDir * -6;
    const endY = fy + flagDir * -18;
    svg += `<path d="M ${stemX} ${fy} C ${stemX + 8} ${cp1y} ${stemX + 12} ${cp2y} ${stemX + 6} ${endY}" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
  }
  return svg;
}

function durationFlags(duration: NoteDuration): number {
  switch (duration) {
    case 'eighth': return 1;
    case 'sixteenth': return 2;
    default: return 0;
  }
}

function isFilledHead(duration: NoteDuration): boolean {
  return duration !== 'whole' && duration !== 'half';
}

function hasStem(duration: NoteDuration): boolean {
  return duration !== 'whole';
}

function dotSvg(x: number, y: number): string {
  return `<circle cx="${x + NOTE_HEAD_RX + 4}" cy="${y}" r="1.5" fill="currentColor"/>`;
}

function ledgerLinesSvg(x: number, y: number, staffTopY: number): string {
  let svg = '';
  const staffBottomY = staffTopY + STAFF_HEIGHT;

  // Lines above staff
  for (let ly = staffTopY - STAFF_LINE_SPACING; ly >= y - 1; ly -= STAFF_LINE_SPACING) {
    svg += `<line x1="${x - 8}" y1="${ly}" x2="${x + 8}" y2="${ly}" stroke="currentColor" stroke-width="1"/>`;
  }
  // Lines below staff
  for (let ly = staffBottomY + STAFF_LINE_SPACING; ly <= y + 1; ly += STAFF_LINE_SPACING) {
    svg += `<line x1="${x - 8}" y1="${ly}" x2="${x + 8}" y2="${ly}" stroke="currentColor" stroke-width="1"/>`;
  }
  return svg;
}

// ─── Rest Rendering ─────────────────────────────────────────────

function restSvg(x: number, staffTopY: number, duration: NoteDuration): string {
  const midY = staffTopY + STAFF_HEIGHT / 2;
  switch (duration) {
    case 'whole':
      return `<rect x="${x - 6}" y="${midY - STAFF_LINE_SPACING}" width="12" height="${STAFF_LINE_SPACING / 2}" fill="currentColor"/>`;
    case 'half':
      return `<rect x="${x - 6}" y="${midY}" width="12" height="${STAFF_LINE_SPACING / 2}" fill="currentColor"/>`;
    case 'quarter':
      return `<path d="M ${x} ${midY - 10} L ${x + 5} ${midY - 3} L ${x - 3} ${midY + 4} L ${x + 4} ${midY + 10}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
    case 'eighth':
      return `<g><circle cx="${x + 2}" cy="${midY - 4}" r="2" fill="currentColor"/><line x1="${x + 2}" y1="${midY - 4}" x2="${x}" y2="${midY + 8}" stroke="currentColor" stroke-width="1.5"/></g>`;
    case 'sixteenth':
      return `<g><circle cx="${x + 2}" cy="${midY - 7}" r="2" fill="currentColor"/><circle cx="${x + 2}" cy="${midY - 1}" r="2" fill="currentColor"/><line x1="${x + 2}" y1="${midY - 7}" x2="${x}" y2="${midY + 8}" stroke="currentColor" stroke-width="1.5"/></g>`;
  }
}

// ─── Key Signature Rendering ────────────────────────────────────

function keySigSvg(key: KeySignature, clef: Clef, x: number, staffTopY: number): string {
  const count = KEY_SIGNATURE_ACCIDENTALS[key];
  if (count === 0) return '';
  const isSharp = count > 0;
  const absCount = Math.abs(count);
  const order = isSharp ? SHARP_ORDER : FLAT_ORDER;

  // Y positions for sharps/flats depend on clef
  const baseOctave = clef === 'bass' ? 2 : 4;
  let svg = '';
  for (let i = 0; i < absCount; i++) {
    const noteName = order[i];
    let octave = baseOctave;
    // Adjust octave to keep accidentals on or near the staff
    if (clef === 'treble') {
      if (isSharp && (noteName === 'C' || noteName === 'D')) octave = 5;
      if (!isSharp && (noteName === 'B' || noteName === 'E' || noteName === 'A')) octave = 4;
    }
    if (clef === 'bass') {
      if (isSharp && (noteName === 'C' || noteName === 'D')) octave = 3;
      if (!isSharp && (noteName === 'A')) octave = 2;
    }
    const pos = pitchToStaffPosition({ note: noteName, octave }, clef);
    const y = staffPositionToY(pos, staffTopY);
    const sx = x + i * KEY_SIG_WIDTH_PER;
    if (isSharp) {
      svg += `<text x="${sx}" y="${y + 4}" font-size="14" fill="currentColor" text-anchor="middle">#</text>`;
    } else {
      svg += `<text x="${sx}" y="${y + 4}" font-size="14" fill="currentColor" text-anchor="middle">b</text>`;
    }
  }
  return svg;
}

// ─── Time Signature Rendering ───────────────────────────────────

function timeSigSvg(ts: TimeSignature, x: number, staffTopY: number): string {
  const topY = staffTopY + STAFF_LINE_SPACING * 0.8;
  const botY = staffTopY + STAFF_LINE_SPACING * 2.8;
  return `
    <text x="${x}" y="${topY}" font-size="18" font-weight="bold" fill="currentColor" text-anchor="middle" font-family="serif">${ts.beats}</text>
    <text x="${x}" y="${botY}" font-size="18" font-weight="bold" fill="currentColor" text-anchor="middle" font-family="serif">${ts.beatType}</text>
  `;
}

// ─── Accidental Symbol ──────────────────────────────────────────

function accidentalSvg(x: number, y: number, acc: 'sharp' | 'flat' | 'natural'): string {
  const ax = x - NOTE_HEAD_RX - 6;
  switch (acc) {
    case 'sharp':
      return `<text x="${ax}" y="${y + 4}" font-size="13" fill="currentColor" text-anchor="middle">#</text>`;
    case 'flat':
      return `<text x="${ax}" y="${y + 4}" font-size="13" fill="currentColor" text-anchor="middle">b</text>`;
    case 'natural':
      return `<text x="${ax}" y="${y + 4}" font-size="13" fill="currentColor" text-anchor="middle">\u266E</text>`;
  }
}

// ─── Full Score Renderer ────────────────────────────────────────

export function renderScoreToSvg(score: MusicScore, options?: {
  selectedStaffId?: string | null;
  selectedMeasureIdx?: number | null;
  selectedNoteIdx?: number | null;
  hoverStaffId?: string | null;
  hoverY?: number | null;
  hoverMeasureIdx?: number | null;
}): string {
  const { width, height, staves, keySignature, timeSignature } = score;
  const sel = options || {};

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="color:#e0d8c8;background:#1a1a1a">`;

  // Title & composer
  if (score.title) {
    svg += `<text x="${width / 2}" y="30" font-size="20" font-weight="bold" fill="#e0d8c8" text-anchor="middle" font-family="serif">${escapeXml(score.title)}</text>`;
  }
  if (score.composer) {
    svg += `<text x="${width - STAFF_RIGHT_MARGIN}" y="50" font-size="12" fill="#999" text-anchor="end" font-family="serif">${escapeXml(score.composer)}</text>`;
  }

  // Render each staff
  let currentY = STAFF_TOP_MARGIN;
  for (const staff of staves) {
    const staffTopY = currentY;
    const isSelectedStaff = sel.selectedStaffId === staff.id;

    // Staff lines
    for (let i = 0; i < 5; i++) {
      const y = staffTopY + i * STAFF_LINE_SPACING;
      svg += `<line x1="${STAFF_LEFT_MARGIN}" y1="${y}" x2="${width - STAFF_RIGHT_MARGIN}" y2="${y}" stroke="${isSelectedStaff ? '#555' : '#444'}" stroke-width="0.8"/>`;
    }

    // Staff name (small, to the left)
    if (staff.name) {
      svg += `<text x="${STAFF_LEFT_MARGIN - 5}" y="${staffTopY + STAFF_HEIGHT / 2 + 4}" font-size="10" fill="#666" text-anchor="end" font-family="sans-serif">${escapeXml(staff.name)}</text>`;
    }

    // Clef
    let xCursor = STAFF_LEFT_MARGIN + 5;
    svg += clefSvg(staff.clef, xCursor, staffTopY + STAFF_HEIGHT / 2);
    xCursor += CLEF_WIDTH;

    // Key signature
    const keySigCount = Math.abs(KEY_SIGNATURE_ACCIDENTALS[keySignature]);
    svg += keySigSvg(keySignature, staff.clef, xCursor + 5, staffTopY);
    xCursor += keySigCount * KEY_SIG_WIDTH_PER + (keySigCount > 0 ? 8 : 0);

    // Time signature
    svg += timeSigSvg(timeSignature, xCursor + TIME_SIG_WIDTH / 2, staffTopY);
    xCursor += TIME_SIG_WIDTH + 10;

    // Calculate measure width
    const totalMeasures = staff.measures.length;
    const availableWidth = (width - STAFF_RIGHT_MARGIN) - xCursor;
    const measureWidth = Math.max(MEASURE_MIN_WIDTH, availableWidth / totalMeasures);

    // Measures
    for (let mi = 0; mi < staff.measures.length; mi++) {
      const measure = staff.measures[mi];
      const measureX = xCursor + mi * measureWidth;
      const isSelectedMeasure = isSelectedStaff && sel.selectedMeasureIdx === mi;

      // Measure highlight
      if (isSelectedMeasure) {
        svg += `<rect x="${measureX}" y="${staffTopY - 3}" width="${measureWidth}" height="${STAFF_HEIGHT + 6}" fill="rgba(255,45,120,0.05)" rx="2"/>`;
      }

      // Bar line at end of measure
      if (mi < staff.measures.length - 1) {
        const barX = measureX + measureWidth;
        svg += `<line x1="${barX}" y1="${staffTopY}" x2="${barX}" y2="${staffTopY + STAFF_HEIGHT}" stroke="#666" stroke-width="1"/>`;
      }

      // Notes within measure
      const noteSpacing = measure.notes.length > 0
        ? (measureWidth - 20) / measure.notes.length
        : measureWidth;

      for (let ni = 0; ni < measure.notes.length; ni++) {
        const note = measure.notes[ni];
        const noteX = measureX + 15 + ni * noteSpacing;
        const isSelectedNote = isSelectedMeasure && sel.selectedNoteIdx === ni;

        if (note.type === 'rest') {
          svg += restSvg(noteX, staffTopY, note.duration);
        } else {
          const position = pitchToStaffPosition(note.pitch, staff.clef);
          const noteY = staffPositionToY(position, staffTopY);
          const filled = isFilledHead(note.duration);
          const stemUp = position < 0; // below middle = stem up

          // Ledger lines
          svg += ledgerLinesSvg(noteX, noteY, staffTopY);

          // Accidental
          if (note.pitch.accidental) {
            svg += accidentalSvg(noteX, noteY, note.pitch.accidental);
          }

          // Note head
          svg += noteHeadSvg(noteX, noteY, filled, isSelectedNote);

          // Stem
          if (hasStem(note.duration)) {
            svg += stemSvg(noteX, noteY, stemUp);
            // Flags
            const flags = durationFlags(note.duration);
            if (flags > 0) {
              svg += flagSvg(noteX, noteY, stemUp, flags);
            }
          }

          // Dot
          if (note.dotted) {
            svg += dotSvg(noteX, noteY);
          }

          // Chord: additional noteheads
          if (note.type === 'chord' && note.pitches) {
            for (const p of note.pitches) {
              const pos = pitchToStaffPosition(p, staff.clef);
              const py = staffPositionToY(pos, staffTopY);
              svg += ledgerLinesSvg(noteX, py, staffTopY);
              svg += noteHeadSvg(noteX, py, filled, isSelectedNote);
            }
          }
        }
      }
    }

    // Double bar line at end
    const endX = width - STAFF_RIGHT_MARGIN;
    svg += `<line x1="${endX - 3}" y1="${staffTopY}" x2="${endX - 3}" y2="${staffTopY + STAFF_HEIGHT}" stroke="#666" stroke-width="1"/>`;
    svg += `<line x1="${endX}" y1="${staffTopY}" x2="${endX}" y2="${staffTopY + STAFF_HEIGHT}" stroke="#666" stroke-width="2.5"/>`;

    currentY += STAFF_HEIGHT + STAFF_GAP;
  }

  svg += '</svg>';
  return svg;
}

/** Render the score SVG onto a canvas element */
export function renderScoreToCanvas(canvas: HTMLCanvasElement, score: MusicScore, options?: Parameters<typeof renderScoreToSvg>[1]): void {
  const svgStr = renderScoreToSvg(score, options);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = score.width;
  canvas.height = score.height;

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, score.width, score.height);
    ctx.drawImage(img, 0, 0);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
}

/** Hit test: given a click at (px, py), determine which staff/measure/pitch was clicked */
export function hitTest(
  score: MusicScore,
  px: number,
  py: number
): { staffId: string; staffClef: Clef; measureIdx: number; pitch: Pitch } | null {
  let currentY = STAFF_TOP_MARGIN;

  for (const staff of score.staves) {
    const staffTopY = currentY;
    const staffBottomY = staffTopY + STAFF_HEIGHT;
    const hitZoneTop = staffTopY - 3 * STAFF_LINE_SPACING;
    const hitZoneBottom = staffBottomY + 3 * STAFF_LINE_SPACING;

    if (py >= hitZoneTop && py <= hitZoneBottom) {
      // Determine measure
      const keySigCount = Math.abs(KEY_SIGNATURE_ACCIDENTALS[score.keySignature]);
      const contentStartX = STAFF_LEFT_MARGIN + 5 + CLEF_WIDTH + keySigCount * KEY_SIG_WIDTH_PER + (keySigCount > 0 ? 8 : 0) + TIME_SIG_WIDTH + 10;
      const availableWidth = (score.width - STAFF_RIGHT_MARGIN) - contentStartX;
      const measureWidth = Math.max(MEASURE_MIN_WIDTH, availableWidth / staff.measures.length);

      const measureIdx = Math.max(0, Math.min(
        staff.measures.length - 1,
        Math.floor((px - contentStartX) / measureWidth)
      ));

      // Determine pitch from Y position
      const middleY = staffTopY + STAFF_HEIGHT / 2;
      const halfSpaces = Math.round((middleY - py) / (STAFF_LINE_SPACING / 2));

      // Convert staff position to pitch
      const middleDiatonic = (() => {
        switch (staff.clef) {
          case 'treble': return 4 * 7 + 6; // B4
          case 'bass':   return 2 * 7 + 3; // D3
          case 'alto':   return 3 * 7 + 0; // C4
          case 'tenor':  return 2 * 7 + 5; // A3
        }
      })();

      const diatonic = middleDiatonic + halfSpaces;
      const octave = Math.floor(diatonic / 7);
      const noteIdx = ((diatonic % 7) + 7) % 7;
      const note = NOTE_NAMES[noteIdx];

      return {
        staffId: staff.id,
        staffClef: staff.clef,
        measureIdx,
        pitch: { note, octave },
      };
    }

    currentY += STAFF_HEIGHT + STAFF_GAP;
  }

  return null;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
