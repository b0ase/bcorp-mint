import type { Measure, MusicScore, Staff } from './music-types';

export function defaultMeasure(): Measure {
  return {
    id: crypto.randomUUID(),
    notes: [],
  };
}

export function defaultStaff(name = 'Treble', clef: Staff['clef'] = 'treble', measureCount = 4): Staff {
  return {
    id: crypto.randomUUID(),
    name,
    clef,
    measures: Array.from({ length: measureCount }, () => defaultMeasure()),
  };
}

export function defaultMusicScore(): MusicScore {
  return {
    title: 'Untitled Score',
    composer: '',
    keySignature: 'C',
    timeSignature: { beats: 4, beatType: 4 },
    tempo: 120,
    staves: [defaultStaff()],
    width: 1200,
    height: 800,
  };
}
