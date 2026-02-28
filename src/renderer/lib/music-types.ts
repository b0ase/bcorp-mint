export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';

export type KeySignature =
  | 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#'
  | 'Cb' | 'Gb' | 'Db' | 'Ab' | 'Eb' | 'Bb' | 'F';

export type TimeSignature = {
  beats: number;
  beatType: number;
};

export type NoteDuration = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export type Pitch = {
  note: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  accidental?: 'sharp' | 'flat' | 'natural';
};

export type MusicNote = {
  id: string;
  type: 'note' | 'rest' | 'chord';
  duration: NoteDuration;
  dotted: boolean;
  pitch: Pitch;
  pitches?: Pitch[];
  tied?: boolean;
};

export type Measure = {
  id: string;
  notes: MusicNote[];
};

export type Staff = {
  id: string;
  name: string;
  clef: Clef;
  measures: Measure[];
};

export type MusicScore = {
  title: string;
  composer: string;
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  tempo: number;
  staves: Staff[];
  width: number;
  height: number;
};

export type MusicTool = 'select' | 'note' | 'rest' | 'eraser';

/** Duration in beats (quarter note = 1) */
export const DURATION_BEATS: Record<NoteDuration, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
};

/** Key signature sharps/flats count (positive = sharps, negative = flats) */
export const KEY_SIGNATURE_ACCIDENTALS: Record<KeySignature, number> = {
  'C': 0,
  'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6,
  'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
};

/** Sharp order for key signatures */
export const SHARP_ORDER: Pitch['note'][] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
/** Flat order for key signatures */
export const FLAT_ORDER: Pitch['note'][] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Note names ordered from bottom of staff (for pitch mapping) */
export const NOTE_NAMES: Pitch['note'][] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
