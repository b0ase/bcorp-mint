import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import type { ImageItem, LogoAsset } from '../lib/types';
import { loadImage, mediaStreamUrl } from '../lib/image-utils';
import { drawLogo, drawVignette } from '../lib/render';

type Props = { mediaItems: ImageItem[]; logos?: LogoAsset[] };

// ── Kinetic Typography ──────────────────────────────────────────────
const KINETIC_FONTS = [
  'Orbitron, monospace', 'Orbitron, monospace', 'Orbitron, monospace',
  'Courier New, Lucida Console, monospace', 'Georgia, Times New Roman, serif',
  'Permanent Marker, cursive', 'Impact, Arial Black, sans-serif',
] as const;
const KINETIC_JA_FONT = 'Hiragino Kaku Gothic Pro, Meiryo, MS Gothic, sans-serif';

interface TextParticle {
  text: string; font: string; x: number; y: number; vx: number; vy: number;
  size: number; rotation: number; vr: number; scale: number; targetScale: number;
  opacity: number; color: string; glow: boolean; glowColor: string; strokeWidth: number;
  life: number; maxLife: number; style: 'main' | 'flash' | 'shout' | 'japanese' | 'gang' | 'whisper';
}

function spawnParticle(text: string, style: TextParticle['style'], cw: number, ch: number, sectionColor: string, beatPulse: number): TextParticle {
  const isJa = style === 'japanese';
  const isShout = style === 'shout' || style === 'gang';
  const isWhisper = style === 'whisper';
  const font = isJa ? KINETIC_JA_FONT : KINETIC_FONTS[Math.floor(Math.random() * KINETIC_FONTS.length)];
  const baseSize = isShout ? 140 + Math.random() * 100 : isWhisper ? 30 + Math.random() * 20 : isJa ? 90 + Math.random() * 80 : 60 + Math.random() * 140;
  const x = cw * (-0.15 + Math.random() * 1.3);
  const y = ch * (-0.1 + Math.random() * 1.2);
  const rotation = (Math.random() - 0.5) * 1.04;
  const speed = 2 + Math.random() * 4 + beatPulse * 5;
  const angle = Math.random() * Math.PI * 2;
  const maxLife = isShout ? 18 + Math.floor(Math.random() * 15) : 10 + Math.floor(Math.random() * 12);
  const color = isJa ? '#DC143C' : isShout ? sectionColor : style === 'gang' ? '#F97316' : isWhisper ? '#94A3B8' : Math.random() < 0.6 ? '#FFFFFF' : sectionColor;
  return {
    text, font, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    size: baseSize, rotation, vr: (Math.random() - 0.5) * 0.05,
    scale: 0.1, targetScale: 1 + beatPulse * 0.5, opacity: 1, color,
    glow: isShout || isJa || Math.random() < 0.3, glowColor: isJa ? '#DC143C' : sectionColor,
    strokeWidth: isShout ? 5 : isJa ? 3 : 2, life: maxLife, maxLife, style,
  };
}

// ── Types ───────────────────────────────────────────────────────────
interface VideoClip { id: string; name: string; url: string; width: number; height: number; orientation: 'portrait' | 'landscape' }
interface TextLayer { id: string; text: string; font: string; color: string; size: number; x: number; y: number; visible: boolean; strobe: boolean; strobeSpeed: number; shake: boolean; shakeRange: number }

// Lyrics stub types (optional, no external dependency)
interface LyricCue { text: string; style: 'main' | 'flash' | 'shout' | 'japanese' | 'gang' | 'whisper'; section: string }
interface TrackLyrics { cues: LyricCue[] }

interface MixerState {
  canvasOrientation: 'portrait' | 'landscape';
  core: { glitch: boolean; glitchIntensity: number; strobe: boolean; strobeChance: number; rgbShift: boolean; rgbShiftAmount: number; reverse: boolean; npgxFilter: boolean; npgxStrength: number; speed: number };
  superFx: { ultraGlitch: boolean; ultraGlitchIntensity: number; realityBreak: boolean; realityBreakIntensity: number; dimensionShift: boolean; dimensionShiftMix: number; kaleidoscope: boolean; kaleidoSegments: number };
  filters: Record<string, boolean>;
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  textLayers: TextLayer[];
  videoFit: 'fill' | 'fit' | 'cinematic';
  chaosMode: boolean;
  beatSync: boolean;
  beatSensitivity: number;
  isRecording: boolean;
  jumpCutSpeed: number;
  fullscreen: boolean;
  lyricsMode: boolean;
  lyricFont: string;
  lyricSize: number;
}

type Action =
  | { type: 'SET_CORE'; key: string; value: number | boolean }
  | { type: 'SET_SUPER'; key: string; value: number | boolean }
  | { type: 'SET_FILTER'; key: string; value: boolean }
  | { type: 'SET_TRANSITION'; value: MixerState['transition'] }
  | { type: 'SET_TEXT'; id: string; patch: Partial<TextLayer> }
  | { type: 'ADD_TEXT' }
  | { type: 'REMOVE_TEXT'; id: string }
  | { type: 'SET'; key: keyof MixerState; value: any }
  | { type: 'CHAOS_TICK' };

const INIT: MixerState = {
  canvasOrientation: 'landscape',
  core: { glitch: false, glitchIntensity: 15, strobe: false, strobeChance: 0.015, rgbShift: false, rgbShiftAmount: 5, reverse: false, npgxFilter: true, npgxStrength: 0.35, speed: 0.7 },
  superFx: { ultraGlitch: false, ultraGlitchIntensity: 10, realityBreak: false, realityBreakIntensity: 15, dimensionShift: false, dimensionShiftMix: 15, kaleidoscope: false, kaleidoSegments: 6 },
  filters: { sepia: false, vintage: false, washedOut: false, drama: false, cool: false, warm: false, noir: false, vibrant: false, faded: false },
  transition: 'none', textLayers: [], videoFit: 'cinematic', chaosMode: true, beatSync: true, beatSensitivity: 0.4,
  isRecording: false, jumpCutSpeed: 800, fullscreen: false, lyricsMode: false, lyricFont: 'neon', lyricSize: 56,
};

function reducer(s: MixerState, a: Action): MixerState {
  switch (a.type) {
    case 'SET_CORE': return { ...s, core: { ...s.core, [a.key]: a.value } };
    case 'SET_SUPER': return { ...s, superFx: { ...s.superFx, [a.key]: a.value } };
    case 'SET_FILTER': return { ...s, filters: { ...s.filters, [a.key]: a.value } };
    case 'SET_TRANSITION': return { ...s, transition: a.value };
    case 'SET_TEXT': return { ...s, textLayers: s.textLayers.map(l => l.id === a.id ? { ...l, ...a.patch } : l) };
    case 'ADD_TEXT': return { ...s, textLayers: [...s.textLayers, { id: `text-${Date.now()}`, text: 'NEW TEXT', font: 'Impact', color: '#FFFFFF', size: 32, x: 0.5, y: 0.5, visible: true, strobe: false, strobeSpeed: 200, shake: false, shakeRange: 5 }] };
    case 'REMOVE_TEXT': return { ...s, textLayers: s.textLayers.filter(l => l.id !== a.id) };
    case 'SET': return { ...s, [a.key]: a.value };
    case 'CHAOS_TICK': return { ...s, core: { ...s.core, reverse: false, speed: 0.5 + Math.random() * 0.5 }, jumpCutSpeed: 150 + Math.random() * 500 };
    default: return s;
  }
}

// ── UI Primitives ───────────────────────────────────────────────────
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div className={`mx-toggle ${enabled ? 'on' : ''}`} onClick={onToggle}>
      <div className="mx-toggle-thumb" />
    </div>
  );
}

function MiniToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        width: 28, height: 14, borderRadius: 7, position: 'relative', cursor: 'pointer',
        background: enabled ? 'var(--accent)' : '#3f3f46', transition: 'background 0.2s',
      }}
      onClick={onToggle}
    >
      <div style={{
        position: 'absolute', top: 1, width: 12, height: 12, borderRadius: 6,
        background: '#fff', transition: 'transform 0.2s',
        transform: enabled ? 'translateX(14px)' : 'translateX(1px)',
      }} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-panel">
      <div className="mx-panel-title">{title}</div>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="mx-slider-row">
      <span className="mx-slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="mx-slider" />
      <span className="mx-slider-value">{step && step < 1 ? value.toFixed(1) : value}{suffix || ''}</span>
    </div>
  );
}

// ── Video Timeline ──────────────────────────────────────────────────
function VideoTimeline({ videos, currentClip, speed, onSpeedChange, onNext, onPrev, onSelectClip }: {
  videos: VideoClip[]; currentClip: number; speed: number; onSpeedChange: (s: number) => void; onNext: () => void; onPrev: () => void; onSelectClip: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ margin: '4px 8px' }}>
      <div className="mx-timeline-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="mx-timeline-collapse" onClick={() => setCollapsed(!collapsed)}>
            <span style={{ display: 'inline-block', fontSize: 10, transition: 'transform 0.2s', transform: collapsed ? '' : 'rotate(90deg)' }}>{'\u25B6'}</span>
          </button>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>Video Timeline</span>
          <button className="mx-btn-sm" onClick={onPrev}>{'\u23EE'} Prev</button>
          <button className="mx-btn-sm mx-btn-accent" onClick={onNext}>Next {'\u23ED'}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Speed:</span>
            <input type="range" min="0.25" max="3" value={speed} step="0.25" onChange={e => onSpeedChange(parseFloat(e.target.value))} className="mx-slider" style={{ width: 64 }} />
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 700, width: 32 }}>{speed.toFixed(1)}x</span>
          </div>
          <span className="mx-badge">{currentClip + 1}/{videos.length}</span>
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <button className="mx-btn-sm" onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}>{'\u25C0'}</button>
            <div ref={scrollRef} style={{ flex: 1, height: 64, background: 'var(--panel-2)', borderRadius: 4, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 1 }}>
              {videos.map((v, idx) => (
                <div key={v.id} onClick={() => onSelectClip(idx)}
                  style={{
                    height: '100%', minWidth: 28, width: 28, flexShrink: 0, cursor: 'pointer',
                    position: 'relative', overflow: 'hidden', transition: 'all 0.2s',
                    outline: idx === currentClip ? '2px solid var(--accent)' : 'none',
                    opacity: idx === currentClip ? 1 : 0.7,
                  }}>
                  <video src={v.url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
                    fontSize: 7, fontFamily: 'monospace', padding: '1px 0',
                    background: idx === currentClip ? 'rgba(233,30,140,0.8)' : 'rgba(0,0,0,0.6)',
                    color: idx === currentClip ? '#fff' : 'var(--muted)',
                  }}>{idx + 1}</div>
                </div>
              ))}
            </div>
            <button className="mx-btn-sm" onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}>{'\u25B6'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Waveform Thumb ──────────────────────────────────────────────────
function WaveformThumb({ url, isActive, width = 80, height = 48 }: { url: string; isActive: boolean; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let seed = 0;
    for (let i = 0; i < url.length; i++) seed = ((seed << 5) - seed + url.charCodeAt(i)) | 0;
    const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff; };
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = isActive ? 'rgba(233, 30, 140, 0.9)' : 'rgba(161, 161, 170, 0.5)';
    let prev = 0.5;
    for (let i = 0; i < width; i++) { prev = prev * 0.7 + rng() * 0.3; const barH = (0.2 + prev * 0.65) * height; ctx.fillRect(i, (height - barH) / 2, 1, barH); }
  }, [url, width, height, isActive]);
  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', imageRendering: 'pixelated' }} />;
}

// ── Audio Timeline ──────────────────────────────────────────────────
function AudioTimeline({ tracks, currentTrack, isPlaying, onToggle, onNext, onPrev, onSelectTrack }: {
  tracks: { title: string; url: string; artist?: string }[]; currentTrack: number; isPlaying: boolean;
  onToggle: () => void; onNext: () => void; onPrev: () => void; onSelectTrack: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  return (
    <div style={{ margin: '0 8px 4px' }}>
      <div className="mx-timeline-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="mx-timeline-collapse" onClick={() => setCollapsed(!collapsed)}>
            <span style={{ display: 'inline-block', fontSize: 10, transition: 'transform 0.2s', transform: collapsed ? '' : 'rotate(90deg)' }}>{'\u25B6'}</span>
          </button>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>{'\u266B'} Audio Timeline</span>
          <button className="mx-btn-sm" onClick={onPrev}>{'\u23EE'}</button>
          <button className="mx-btn-sm mx-btn-accent" onClick={onToggle}>{isPlaying ? '\u23F8' : '\u25B6'}</button>
          <button className="mx-btn-sm" onClick={onNext}>{'\u23ED'}</button>
          <span className="mx-badge" style={{ marginLeft: 'auto', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tracks[currentTrack]?.title || 'No audio'}</span>
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <button className="mx-btn-sm" onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}>{'\u25C0'}</button>
            <div ref={scrollRef} style={{ flex: 1, height: 64, background: 'var(--panel-2)', borderRadius: 4, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 1 }}>
              {tracks.map((t, idx) => (
                <div key={idx} onClick={() => onSelectTrack(idx)}
                  style={{
                    height: '100%', minWidth: 80, width: 80, flexShrink: 0, cursor: 'pointer',
                    position: 'relative', overflow: 'hidden', transition: 'all 0.2s',
                    outline: idx === currentTrack ? '2px solid var(--accent)' : 'none',
                    opacity: idx === currentTrack ? 1 : 0.7,
                  }}>
                  <WaveformThumb url={t.url} isActive={idx === currentTrack} width={80} height={64} />
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center',
                    fontSize: 6, fontFamily: 'monospace', padding: '1px 2px',
                    background: idx === currentTrack ? 'rgba(233,30,140,0.8)' : 'rgba(0,0,0,0.6)',
                    color: idx === currentTrack ? '#fff' : 'var(--muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.title}</div>
                </div>
              ))}
            </div>
            <button className="mx-btn-sm" onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}>{'\u25B6'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panels ──────────────────────────────────────────────────────────
function SuperFxPanel({ state, dispatch }: { state: MixerState; dispatch: React.Dispatch<Action> }) {
  const fx = state.superFx;
  return (
    <Panel title="Super FX">
      {([['ultraGlitch', 'Ultra Glitch', 'ultraGlitchIntensity', 100], ['realityBreak', 'Reality Break', 'realityBreakIntensity', 100], ['dimensionShift', 'Dimension Shift', 'dimensionShiftMix', 100], ['kaleidoscope', 'Kaleidoscope', 'kaleidoSegments', 16]] as const).map(([key, label, slider, max]) => (
        <div key={key} className="mx-fx-item">
          <div className="mx-fx-header"><span className="mx-fx-name">{label}</span><Toggle enabled={fx[key] as boolean} onToggle={() => dispatch({ type: 'SET_SUPER', key, value: !fx[key] })} /></div>
          {fx[key] && <div className="mx-fx-body"><Slider label="Intensity" value={fx[slider] as number} min={key === 'kaleidoscope' ? 2 : 0} max={max} onChange={v => dispatch({ type: 'SET_SUPER', key: slider, value: v })} /></div>}
        </div>
      ))}
    </Panel>
  );
}

function EffectsPanel({ state, dispatch }: { state: MixerState; dispatch: React.Dispatch<Action> }) {
  const c = state.core;
  return (
    <Panel title="Effects">
      {([['glitch', 'Glitch', 'glitchIntensity', 100], ['strobe', 'Strobe', 'strobeChance', 1], ['rgbShift', 'RGB Shift', 'rgbShiftAmount', 30], ['npgxFilter', 'Crimson Filter', 'npgxStrength', 1]] as const).map(([key, label, slider, max]) => (
        <div key={key} className="mx-fx-item">
          <div className="mx-fx-header"><span className="mx-fx-name">{label}</span><Toggle enabled={c[key] as boolean} onToggle={() => dispatch({ type: 'SET_CORE', key, value: !c[key] })} /></div>
          {c[key] && <div className="mx-fx-body"><Slider label="Amount" value={c[slider] as number} min={0} max={max} step={max <= 1 ? 0.05 : 1} onChange={v => dispatch({ type: 'SET_CORE', key: slider, value: v })} /></div>}
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(233,30,140,0.1)', paddingTop: 10, marginTop: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Filters</div>
        <div className="mx-filter-grid">
          {Object.keys(state.filters).map(f => (
            <label key={f} className="mx-filter-label">
              <input type="checkbox" className="mx-filter-check" checked={state.filters[f]} onChange={() => dispatch({ type: 'SET_FILTER', key: f, value: !state.filters[f] })} />
              <span>{f.charAt(0).toUpperCase() + f.slice(1).replace(/([A-Z])/g, ' $1')}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ padding: '8px 12px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Transitions</div>
        <select value={state.transition} onChange={e => dispatch({ type: 'SET_TRANSITION', value: e.target.value as any })} style={{ width: '100%', padding: '6px 8px', background: 'var(--panel-3)', border: '1px solid rgba(233,30,140,0.2)', borderRadius: 6, color: '#fff', fontSize: 12 }}>
          <option value="none">No Wipe</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="zoom">Zoom</option>
        </select>
      </div>
    </Panel>
  );
}

function TextPanel({ state, dispatch }: { state: MixerState; dispatch: React.Dispatch<Action> }) {
  return (
    <Panel title="Text Layers">
      <div style={{ padding: '8px 12px' }}>
        <button className="mx-btn-sm mx-btn-accent" onClick={() => dispatch({ type: 'ADD_TEXT' })} style={{ width: '100%', marginBottom: 8 }}>+ Add Text</button>
      </div>
      {state.textLayers.map(layer => (
        <div key={layer.id} style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <MiniToggle enabled={layer.visible} onToggle={() => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { visible: !layer.visible } })} />
            <button className="mx-btn-sm" onClick={() => dispatch({ type: 'REMOVE_TEXT', id: layer.id })} style={{ color: 'var(--danger)' }}>Remove</button>
          </div>
          <input type="text" value={layer.text} onChange={e => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { text: e.target.value } })} style={{ width: '100%', background: 'var(--panel-3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 8px', fontSize: 12, marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <select value={layer.font} onChange={e => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { font: e.target.value } })} style={{ flex: 1, background: 'var(--panel-3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '3px 6px', fontSize: 11 }}>
              <option value="Impact">Impact</option><option value="Arial">Arial</option><option value="Courier New">Courier New</option>
              <option value="Orbitron, monospace">Neon</option><option value="Permanent Marker, cursive">Graffiti</option>
            </select>
            <input type="color" value={layer.color} onChange={e => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { color: e.target.value } })} style={{ width: 32, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
          </div>
          <Slider label="Size" value={layer.size} min={10} max={120} onChange={v => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { size: v } })} suffix="px" />
          <Slider label="X" value={Math.round(layer.x * 100)} min={0} max={100} onChange={v => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { x: v / 100 } })} suffix="%" />
          <Slider label="Y" value={Math.round(layer.y * 100)} min={0} max={100} onChange={v => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { y: v / 100 } })} suffix="%" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 10 }}>
            <label className="mx-filter-label"><input type="checkbox" className="mx-filter-check" checked={layer.strobe} onChange={() => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { strobe: !layer.strobe } })} /> Strobe</label>
            <label className="mx-filter-label"><input type="checkbox" className="mx-filter-check" checked={layer.shake} onChange={() => dispatch({ type: 'SET_TEXT', id: layer.id, patch: { shake: !layer.shake } })} /> Shake</label>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function SettingsPanel({ state, dispatch, clipCount, currentClip, onRecord, onStopRecord }: {
  state: MixerState; dispatch: React.Dispatch<Action>; clipCount: number; currentClip: number; onRecord: () => void; onStopRecord: () => void;
}) {
  return (
    <Panel title="Settings">
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {state.isRecording
            ? <button className="mx-rec-stop-btn" onClick={onStopRecord} style={{ flex: 1 }}>{'\u23F9'} Stop Recording</button>
            : <button className="mx-rec-start-btn" onClick={onRecord} style={{ flex: 1 }}>{'\u23FA'} Record</button>}
        </div>

        {/* Video Mode */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Video Mode</div>
          <div className="mx-fit-grid">
            {([['fill', 'Fill'], ['cinematic', 'Cinema'], ['fit', 'Fit']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => dispatch({ type: 'SET', key: 'videoFit', value: mode })} className={`mx-fit-btn ${state.videoFit === mode ? 'active' : ''}`}>{label}</button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Canvas</div>
          <div className="mx-fit-grid">
            {(['portrait', 'landscape'] as const).map(o => (
              <button key={o} onClick={() => dispatch({ type: 'SET', key: 'canvasOrientation', value: o })} className={`mx-fit-btn ${state.canvasOrientation === o ? 'active' : ''}`}>{o === 'portrait' ? '9:16' : '16:9'}</button>
            ))}
          </div>
        </div>

        {/* Chaos Mode */}
        <div className="mx-fx-item">
          <div className="mx-fx-header"><span className="mx-fx-name">{'\u26A1'} Chaos Mode</span><Toggle enabled={state.chaosMode} onToggle={() => dispatch({ type: 'SET', key: 'chaosMode', value: !state.chaosMode })} /></div>
        </div>

        {/* Beat Sync */}
        <div className="mx-fx-item">
          <div className="mx-fx-header"><span className="mx-fx-name">{'\u266B'} Beat Sync</span><Toggle enabled={state.beatSync} onToggle={() => dispatch({ type: 'SET', key: 'beatSync', value: !state.beatSync })} /></div>
          {state.beatSync && <div className="mx-fx-body"><Slider label="Sensitivity" value={state.beatSensitivity} min={0.1} max={1} step={0.05} onChange={v => dispatch({ type: 'SET', key: 'beatSensitivity', value: v })} /></div>}
        </div>

        {/* Jump Cut Speed */}
        <Slider label="Jump Cut" value={state.jumpCutSpeed} min={50} max={2000} step={50} onChange={v => dispatch({ type: 'SET', key: 'jumpCutSpeed', value: v })} suffix="ms" />

        {/* Lyrics Mode */}
        <div className="mx-fx-item">
          <div className="mx-fx-header"><span className="mx-fx-name">{'\u2606'} Lyrics Overlay</span><Toggle enabled={state.lyricsMode} onToggle={() => dispatch({ type: 'SET', key: 'lyricsMode', value: !state.lyricsMode })} /></div>
          {state.lyricsMode && <div className="mx-fx-body"><Slider label="Size" value={state.lyricSize} min={24} max={96} step={2} onChange={v => dispatch({ type: 'SET', key: 'lyricSize', value: v })} suffix="px" /></div>}
        </div>

        {/* Info */}
        <div className="mx-info-grid" style={{ marginTop: 8 }}>
          {[['Clip', `${currentClip + 1} / ${clipCount}`], ['Mode', state.videoFit.toUpperCase()], ['Canvas', state.canvasOrientation === 'portrait' ? '9:16' : '16:9'], ['Chaos', state.chaosMode ? 'ON' : 'OFF'], ['Beat', state.beatSync ? 'ON' : 'OFF']].map(([label, value]) => (
            <React.Fragment key={label}><span className="mx-info-label">{label}:</span><span className="mx-info-value">{value}</span></React.Fragment>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Mobile helpers ──────────────────────────────────────────────────
const PANEL_KEYS = ['super-fx', 'effects', 'preview', 'text', 'settings'] as const;
const PANEL_LABELS: Record<string, string> = { 'super-fx': '\u26A1 Super FX', 'effects': '\u2699 Effects', 'preview': '\u25A3 Preview', 'text': '\u0054 Text', 'settings': '\u2699 Settings' };

// ══════════════════════════════════════════════════════════════════════
//  MAIN MIXER
// ══════════════════════════════════════════════════════════════════════

export default function VideoMixer({ mediaItems, logos }: Props) {
  const mountCountRef = useRef(0);
  mountCountRef.current++;
  if (mountCountRef.current <= 2) console.log('[mixer] RENDER #' + mountCountRef.current, 'mediaItems:', mediaItems.length);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mixerLogoRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const stateRef = useRef<MixerState>(INIT);
  const beatPulseRef = useRef(0);
  const bassAvgRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transitionRef = useRef({ active: false, progress: 0, startTime: 0 });
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<TextParticle[]>([]);
  const lastCueIndexRef = useRef(-1);
  const lyricsRef = useRef<TrackLyrics | null>(null);
  const musicProgressRef = useRef(0);
  const musicDurationRef = useRef(0);

  const [state, dispatch] = useReducer(reducer, INIT);
  const [videos, setVideos] = useState<VideoClip[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // ── Local audio player state ──────────────────────────────────────
  const [audioTracks, setAudioTracks] = useState<{ title: string; url: string }[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Refs for render-loop access (avoid stale closures)
  const audioTracksRef = useRef(audioTracks);
  const currentAudioTrackRef = useRef(currentAudioTrack);
  audioTracksRef.current = audioTracks;
  currentAudioTrackRef.current = currentAudioTrack;

  // Sync stateRef
  useEffect(() => { stateRef.current = state; }, [state]);

  // Load logo for stamp overlay on mixer output
  useEffect(() => {
    if (!logos || logos.length === 0) return;
    // Use first video's logo setting, or fall back to first logo
    const firstVideo = mediaItems.find(m => m.mediaType === 'video');
    const logoId = firstVideo?.settings?.logoId || logos[0]?.id;
    const logoAsset = logos.find(l => l.id === logoId) || logos[0];
    if (logoAsset) {
      loadImage(logoAsset.src).then(img => { mixerLogoRef.current = img; }).catch(() => {});
    }
  }, [logos, mediaItems]);

  // ── Convert mediaItems to video clips & audio tracks ──────────────
  useEffect(() => {
    const videoItems = mediaItems.filter(item => item.mediaType === 'video');
    if (videoItems.length === 0) { setVideos([]); return; }
    const clips: VideoClip[] = videoItems.map((item, i) => ({
      id: item.id || `clip-${i}`,
      name: item.name,
      url: mediaStreamUrl(item.path),
      width: item.width || 1920,
      height: item.height || 1080,
      orientation: (item.width && item.height && item.height > item.width) ? 'portrait' as const : 'landscape' as const,
    }));
    // Shuffle
    for (let i = clips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clips[i], clips[j]] = [clips[j], clips[i]];
    }
    setVideos(clips);
  }, [mediaItems]);

  useEffect(() => {
    const audioItems = mediaItems.filter(item => item.mediaType === 'audio');
    const tracks = audioItems.map(item => ({
      title: item.name,
      url: mediaStreamUrl(item.path),
    }));
    setAudioTracks(tracks);
  }, [mediaItems]);

  // ── Video loading ─────────────────────────────────────────────────
  const loadingRef = useRef(false);
  useEffect(() => {
    const vid = videoRef.current;
    if (videos.length === 0 || !vid) return;
    const clip = videos[currentVideoIndex];
    if (!clip) return;
    if (loadingRef.current) return; // debounce rapid switches
    loadingRef.current = true;

    console.log('[mixer] loading clip', currentVideoIndex, clip.name);

    const onLoaded = () => {
      loadingRef.current = false;
      console.log('[mixer] video loaded, readyState:', vid.readyState, 'size:', vid.videoWidth, 'x', vid.videoHeight);
      vid.play().catch(() => {});
    };
    const onError = () => {
      loadingRef.current = false;
      console.warn('[mixer] video error for clip', currentVideoIndex);
      // Don't auto-skip — let jump-cut handle it
    };

    vid.removeEventListener('loadeddata', onLoaded);
    vid.removeEventListener('error', onError);
    vid.addEventListener('loadeddata', onLoaded, { once: true });
    vid.addEventListener('error', onError, { once: true });
    vid.src = clip.url;
    vid.load();

    return () => {
      vid.removeEventListener('loadeddata', onLoaded);
      vid.removeEventListener('error', onError);
    };
  }, [currentVideoIndex, videos]);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = state.core.speed; }, [state.core.speed]);

  // ── Audio loading ─────────────────────────────────────────────────
  useEffect(() => {
    if (audioTracks.length > 0 && audioRef.current) {
      const track = audioTracks[currentAudioTrack];
      if (!track) return;
      audioRef.current.src = track.url;
      audioRef.current.load();
      if (isAudioPlaying) audioRef.current.play().catch(() => {});
    }
  }, [currentAudioTrack, audioTracks]); // eslint-disable-line

  // Auto-play audio on mount
  useEffect(() => {
    if (audioTracks.length > 0 && audioRef.current && !isAudioPlaying) {
      audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {});
    }
  }, [audioTracks]); // eslint-disable-line

  // Audio progress tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => { musicProgressRef.current = audio.currentTime; musicDurationRef.current = audio.duration || 0; };
    audio.addEventListener('timeupdate', onTime);
    return () => audio.removeEventListener('timeupdate', onTime);
  }, []);

  const toggleAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { audio.play().catch(() => {}); setIsAudioPlaying(true); }
    else { audio.pause(); setIsAudioPlaying(false); }
  }, []);

  const nextAudioTrack = useCallback(() => {
    if (audioTracks.length === 0) return;
    setCurrentAudioTrack(p => (p + 1) % audioTracks.length);
    setIsAudioPlaying(true);
  }, [audioTracks.length]);

  const prevAudioTrack = useCallback(() => {
    if (audioTracks.length === 0) return;
    setCurrentAudioTrack(p => (p - 1 + audioTracks.length) % audioTracks.length);
    setIsAudioPlaying(true);
  }, [audioTracks.length]);

  // ── Beat detection ────────────────────────────────────────────────
  const setupBeatDetection = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioCtxRef.current) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      analyserRef.current = analyser;
    } catch (e) { console.warn('[mixer] Audio analysis setup failed:', e); }
  }, []);

  useEffect(() => {
    setupBeatDetection();
    const retry = () => { setupBeatDetection(); document.removeEventListener('click', retry); };
    document.addEventListener('click', retry, { once: true });
    return () => document.removeEventListener('click', retry);
  }, [setupBeatDetection]);

  // ── Chaos mode ────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.chaosMode) return;
    const id = setInterval(() => dispatch({ type: 'CHAOS_TICK' }), 3000);
    return () => clearInterval(id);
  }, [state.chaosMode]);

  // ── Jump cuts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (videos.length === 0) return;
    let lastSwitch = 0;
    const id = setInterval(() => {
      const now = Date.now();
      if (Math.random() < 0.2 && now - lastSwitch > 3000 && videos.length > 1) {
        lastSwitch = now;
        setCurrentVideoIndex(Math.floor(Math.random() * videos.length));
      } else if (videoRef.current?.duration) {
        videoRef.current.currentTime = Math.random() * videoRef.current.duration;
      }
    }, state.jumpCutSpeed);
    return () => clearInterval(id);
  }, [videos, state.jumpCutSpeed]);

  // ── Canvas render loop ────────────────────────────────────────────
  useEffect(() => {
    let running = true;
    let frameCount = 0;
    const freqData = new Uint8Array(128);
    console.log('[mixer] render loop STARTED');

    const render = () => {
      if (!running) return;
      frameCount++;
      if (frameCount === 1 || frameCount === 60 || frameCount % 300 === 0) {
        console.log('[mixer] render frame', frameCount, 'canvas:', !!canvasRef.current, 'video:', !!videoRef.current, 'readyState:', videoRef.current?.readyState);
      }
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        // Refs not ready yet — retry next frame
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) { animFrameRef.current = requestAnimationFrame(render); return; }
      const s = stateRef.current;
      const isPortrait = s.canvasOrientation === 'portrait';
      const cw = isPortrait ? 720 : 1280;
      const ch = isPortrait ? 1280 : 720;
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }

      // Beat detection
      if (analyserRef.current && s.beatSync) {
        analyserRef.current.getByteFrequencyData(freqData);
        let bass = 0;
        for (let i = 0; i < 6; i++) bass += freqData[i];
        bass /= 6;
        bassAvgRef.current = bassAvgRef.current * 0.92 + bass * 0.08;
        const threshold = bassAvgRef.current * (1 + s.beatSensitivity);
        if (bass > threshold && bass > 80) {
          beatPulseRef.current = Math.min(1, beatPulseRef.current + 0.6);
          if (beatPulseRef.current > 0.5 && Math.random() < 0.3) {
            if (Math.random() < 0.15 && videos.length > 1) setCurrentVideoIndex(Math.floor(Math.random() * videos.length));
            else if (video.duration) video.currentTime = Math.random() * video.duration;
          }
        }
        beatPulseRef.current *= 0.92;
      } else { beatPulseRef.current *= 0.95; }
      const bp = beatPulseRef.current;

      const hasAnyData = video.readyState >= 1;
      const videoReady = video.readyState >= 2;

      if (hasAnyData) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cw, ch);
        const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
        const isPortraitClip = vh > vw;
        const fitMode = s.videoFit || 'cinematic';

        // Kaleidoscope
        if (s.superFx.kaleidoscope) {
          const segs = s.superFx.kaleidoSegments;
          ctx.save(); ctx.translate(cw / 2, ch / 2);
          for (let seg = 0; seg < segs; seg++) {
            ctx.save(); ctx.rotate((seg * Math.PI * 2) / segs);
            if (seg % 2 === 1) ctx.scale(1, -1);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cw, 0);
            ctx.lineTo(cw * Math.cos(Math.PI * 2 / segs), cw * Math.sin(Math.PI * 2 / segs));
            ctx.closePath(); ctx.clip();
            ctx.drawImage(video, -cw / 2, -ch / 2, cw, ch);
            ctx.restore();
          }
          ctx.restore();
        } else if (fitMode === 'fill') {
          const scale = Math.max(cw / vw, ch / vh);
          ctx.drawImage(video, (cw - vw * scale) / 2, (ch - vh * scale) / 2, vw * scale, vh * scale);
        } else if (fitMode === 'cinematic' && isPortraitClip) {
          const bgScale = Math.max(cw / vw, ch / vh) * 1.15;
          ctx.filter = 'blur(20px) brightness(0.3)';
          ctx.drawImage(video, (cw - vw * bgScale) / 2, (ch - vh * bgScale) / 2, vw * bgScale, vh * bgScale);
          ctx.filter = 'none';
          const fgScale = Math.min(cw / vw, ch / vh);
          ctx.drawImage(video, (cw - vw * fgScale) / 2, (ch - vh * fgScale) / 2, vw * fgScale, vh * fgScale);
        } else {
          const scale = Math.min(cw / vw, ch / vh);
          ctx.drawImage(video, (cw - vw * scale) / 2, (ch - vh * scale) / 2, vw * scale, vh * scale);
        }

        if (videoReady && !video.seeking) {
          if (!bufferCanvasRef.current) bufferCanvasRef.current = document.createElement('canvas');
          const buf = bufferCanvasRef.current;
          if (buf.width !== cw || buf.height !== ch) { buf.width = cw; buf.height = ch; }
          buf.getContext('2d')?.drawImage(canvas, 0, 0);
        }
      } else if (bufferCanvasRef.current) {
        ctx.drawImage(bufferCanvasRef.current, 0, 0, cw, ch);
      }

      // ── Super FX ──────────────────────────────────────────────────
      if (s.superFx.ultraGlitch) {
        const intensity = s.superFx.ultraGlitchIntensity * (1 + bp);
        for (let i = 0; i < Math.floor(intensity / 10); i++) {
          const sx = Math.random() * cw, sy = Math.random() * ch;
          try { const block = ctx.getImageData(sx, sy, 20 + Math.random() * intensity * 2, 5 + Math.random() * 30); ctx.putImageData(block, sx + (Math.random() - 0.5) * intensity * 2, sy); } catch {}
        }
      }
      if (s.superFx.realityBreak) {
        const intensity = s.superFx.realityBreakIntensity * (1 + bp * 2);
        for (let i = 0; i < Math.floor(intensity / 5); i++) {
          const y = Math.floor(Math.random() * ch);
          try { const strip = ctx.getImageData(0, y, cw, 2 + Math.floor(Math.random() * 8)); ctx.putImageData(strip, (Math.random() - 0.5) * intensity, y); } catch {}
        }
      }
      if (s.superFx.dimensionShift) {
        const shift = Math.floor(s.superFx.dimensionShiftMix * (1 + bp) / 100 * 15);
        if (shift > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.drawImage(canvas, shift, 0); ctx.drawImage(canvas, -shift, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      }

      // ── Color filters ─────────────────────────────────────────────
      const filterParts: string[] = [];
      if (s.filters.sepia) filterParts.push('sepia(1)');
      if (s.filters.noir) filterParts.push('grayscale(1) contrast(1.5)');
      if (s.filters.cool) filterParts.push('hue-rotate(15deg) saturate(1.1)');
      if (s.filters.warm) filterParts.push('sepia(0.25) saturate(1.2)');
      if (s.filters.vibrant) filterParts.push('saturate(1.6)');
      if (s.filters.faded) filterParts.push('brightness(1.2) contrast(0.75)');
      if (s.filters.vintage) filterParts.push('sepia(0.35) contrast(0.9) brightness(1.05)');
      if (s.filters.drama) filterParts.push('contrast(1.5) brightness(0.85)');
      if (s.filters.washedOut) filterParts.push('brightness(1.25) contrast(0.7)');
      if (filterParts.length > 0) { ctx.filter = filterParts.join(' '); ctx.drawImage(canvas, 0, 0); ctx.filter = 'none'; }

      // ── Crimson filter ────────────────────────────────────────────
      if (s.core.npgxFilter) {
        const str = s.core.npgxStrength;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgb(255, ${Math.round(255 - str * 40)}, ${Math.round(255 - str * 80)})`;
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(60, 0, 0, ${str * 0.15})`;
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = 'source-over';
      }

      // ── Pixel effects ─────────────────────────────────────────────
      if (s.core.glitch || s.core.rgbShift) {
        const intensity = s.core.glitchIntensity * (1 + bp);
        try {
          const imageData = ctx.getImageData(0, 0, cw, ch);
          const d = imageData.data;
          if (s.core.glitch) { const threshold = intensity / 8000; for (let i = 0; i < d.length; i += 64) { if (Math.random() < threshold) { d[i] = 255; d[i + 1] = Math.random() * 50; d[i + 2] = Math.random() * 50; } } }
          if (s.core.rgbShift) { const shift = Math.floor(Math.sin(Date.now() / 100) * s.core.rgbShiftAmount * (1 + bp)) * 4; if (shift !== 0) { for (let i = 0; i < d.length; i += 4) { const si = i + shift; if (si >= 0 && si < d.length) d[i] = d[si + 1]; } } }
          ctx.putImageData(imageData, 0, 0);
        } catch {}
      }

      if (s.core.glitch && Math.random() < (s.core.glitchIntensity * (1 + bp)) / 100) {
        ctx.fillStyle = `rgba(220,${Math.random() * 20 | 0},${Math.random() * 60 | 0},0.4)`;
        ctx.fillRect(Math.random() * cw, Math.random() * ch, Math.random() * 100, Math.random() * 100);
      }

      if (s.core.strobe) {
        const chance = s.beatSync ? (bp > 0.6 ? 0.04 : 0.005) : s.core.strobeChance;
        if (Math.random() < chance) { ctx.fillStyle = `rgba(220, 20, 60, ${0.12 + bp * 0.18})`; ctx.fillRect(0, 0, cw, ch); }
      }

      // ── Transition overlay ────────────────────────────────────────
      if (transitionRef.current.active) {
        const elapsed = performance.now() - transitionRef.current.startTime;
        const progress = Math.min(1, elapsed / 300);
        if (s.transition === 'fade') { ctx.fillStyle = `rgba(0,0,0,${1 - progress})`; ctx.fillRect(0, 0, cw, ch); }
        else if (s.transition === 'zoom') { const z = 1 + (1 - progress) * 0.3; ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.scale(z, z); ctx.translate(-cw / 2, -ch / 2); ctx.globalAlpha = progress; ctx.drawImage(canvas, 0, 0); ctx.restore(); ctx.globalAlpha = 1; }
        if (progress >= 1) transitionRef.current.active = false;
      }

      // ── Text layers ───────────────────────────────────────────────
      const now = Date.now();
      for (const layer of s.textLayers) {
        if (!layer.visible) continue;
        if (layer.strobe && (now % (layer.strobeSpeed * 2)) > layer.strobeSpeed) continue;
        let tx = layer.x * cw, ty = layer.y * ch;
        if (layer.shake) { const range = layer.shakeRange * (1 + bp * 3); tx += (Math.random() - 0.5) * range * 2; ty += (Math.random() - 0.5) * range * 2; }
        ctx.font = `900 ${layer.size * (1 + bp * 0.1)}px ${layer.font}, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 3; ctx.strokeText(layer.text, tx, ty);
        ctx.fillStyle = layer.color; ctx.shadowColor = layer.color; ctx.shadowBlur = 8 + bp * 20; ctx.fillText(layer.text, tx, ty); ctx.shadowBlur = 0;
      }

      // ── Kinetic Typography (lyrics) ───────────────────────────────
      if (s.lyricsMode && lyricsRef.current) {
        const lyrics = lyricsRef.current;
        const totalCues = lyrics.cues.length;
        const dur = musicDurationRef.current;
        const prog = musicProgressRef.current;
        const secColors: Record<string, string> = { chorus: '#DC143C', verse: '#FFFFFF', bridge: '#A855F7', breakdown: '#F97316', intro: '#22D3EE', outro: '#F97316' };

        if (totalCues > 0 && dur > 0) {
          const cueTime = dur / totalCues;
          const cueIndex = Math.min(Math.floor(prog / cueTime), totalCues - 1);
          const currentCue = lyrics.cues[Math.max(0, cueIndex)];
          const sColor = secColors[currentCue.section] || '#FFFFFF';

          if (cueIndex !== lastCueIndexRef.current) {
            lastCueIndexRef.current = cueIndex;
            const count = currentCue.style === 'shout' || currentCue.style === 'gang' ? 6 : 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) particlesRef.current.push(spawnParticle(currentCue.text, currentCue.style, cw, ch, sColor, bp));
            for (const w of currentCue.text.split(/\s+/).filter(w => w.length > 1)) { if (Math.random() < 0.7) particlesRef.current.push(spawnParticle(w, 'flash', cw, ch, sColor, bp)); }
            for (let i = Math.max(0, cueIndex - 3); i <= Math.min(totalCues - 1, cueIndex + 3); i++) {
              if (lyrics.cues[i].style === 'japanese' && i !== cueIndex && Math.random() < 0.7) particlesRef.current.push(spawnParticle(lyrics.cues[i].text, 'japanese', cw, ch, sColor, bp));
            }
          }

          if (bp > 0.3) {
            const flashCount = bp > 0.7 ? 4 : bp > 0.5 ? 3 : 2;
            for (let f = 0; f < flashCount; f++) {
              if (Math.random() < 0.7) {
                const source = lyrics.cues[Math.floor(Math.random() * totalCues)];
                const words = source.text.split(/\s+/).filter(w => w.length > 1);
                particlesRef.current.push(spawnParticle(words[Math.floor(Math.random() * words.length)] || source.text, 'flash', cw, ch, sColor, bp));
              }
            }
          }
        }

        // Update & draw particles
        const alive: TextParticle[] = [];
        for (const p of particlesRef.current) {
          p.life--;
          if (p.life <= 0) continue;
          p.x += p.vx; p.y += p.vy; p.rotation += p.vr;
          const lifeRatio = p.life / p.maxLife;
          if (lifeRatio > 0.8) p.scale += (p.targetScale - p.scale) * 0.7;
          else if (lifeRatio < 0.15) p.scale *= 0.8;
          p.opacity = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1;
          const fontSize = p.size * p.scale * (1 + bp * 0.15);
          if (fontSize < 2) continue;
          ctx.save(); ctx.globalAlpha = p.opacity; ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
          ctx.font = `900 ${fontSize}px ${p.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
          if (p.glow) { ctx.shadowColor = p.glowColor; ctx.shadowBlur = 15 + bp * 40; }
          ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = p.strokeWidth; ctx.strokeText(p.text, 0, 0);
          ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
          ctx.restore();
          alive.push(p);
        }
        particlesRef.current = alive.length > 120 ? alive.slice(-120) : alive;
      }

      // Track title when lyrics mode on but no lyrics data
      if (s.lyricsMode && !lyricsRef.current && audioTracksRef.current.length > 0) {
        const trackTitle = audioTracksRef.current[currentAudioTrackRef.current]?.title || '';
        if (trackTitle) {
          ctx.save(); ctx.globalAlpha = 0.5 + bp * 0.3;
          ctx.font = '900 32px Orbitron, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2;
          ctx.strokeText(trackTitle, cw / 2, ch * 0.5); ctx.fillStyle = '#FFFFFF'; ctx.fillText(trackTitle, cw / 2, ch * 0.5);
          ctx.restore();
        }
      }

      // Stamp logo overlay on mixer output — smaller than default stamp size
      const logoImg = mixerLogoRef.current;
      if (logoImg) {
        const firstVideo = mediaItems.find(m => m.mediaType === 'video');
        const stampSettings = firstVideo?.settings;
        if (stampSettings) {
          const mixerSettings = { ...stampSettings, logoScale: 0.12, logoPos: { x: 0.88, y: 0.08 } };
          const dummyImg = { naturalWidth: cw, naturalHeight: ch, width: cw, height: ch } as HTMLImageElement;
          drawLogo(ctx, dummyImg, logoImg, mixerSettings, { offsetX: 0, offsetY: 0, drawWidth: cw, drawHeight: ch, scale: 1 });
        }
      }

      // Beat pulse bar
      if (s.beatSync && bp > 0.05) { ctx.fillStyle = `rgba(255, 0, 64, ${bp * 0.6})`; ctx.fillRect(0, ch - 4, cw * bp, 4); }

      animFrameRef.current = requestAnimationFrame(render);
    };
    render();
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, []); // eslint-disable-line — render loop runs once, reads refs

  // ── Recording ─────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const stream = canvas.captureStream(30);
      if (audioCtxRef.current && sourceNodeRef.current) {
        const dest = audioCtxRef.current.createMediaStreamDestination();
        sourceNodeRef.current.connect(dest);
        for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5_000_000 });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `npgx-mix-${Date.now()}.webm`; a.click();
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      dispatch({ type: 'SET', key: 'isRecording', value: true });
    } catch (e) { console.error('[mixer] Recording failed:', e); }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') { recorderRef.current.stop(); recorderRef.current = null; }
    dispatch({ type: 'SET', key: 'isRecording', value: false });
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = useCallback(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); toggleAudio(); }
      if (e.key === 'c' || e.key === 'C') dispatch({ type: 'SET', key: 'chaosMode', value: !stateRef.current.chaosMode });
      if (e.key === 'r' || e.key === 'R') { if (stateRef.current.isRecording) stopRecording(); else startRecording(); }
      if (e.key === 'n' || e.key === 'N') setCurrentVideoIndex(p => (p + 1) % Math.max(1, videos.length));
      if (e.key === 'b' || e.key === 'B') setCurrentVideoIndex(p => (p - 1 + videos.length) % Math.max(1, videos.length));
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videos.length, toggleAudio, startRecording, stopRecording, toggleFullscreen]);

  // ── Layout (mobile tab) ───────────────────────────────────────────
  const [mobilePanel, setMobilePanel] = useState(2);

  const panelProps = { state, dispatch };
  const settingsExtra = { clipCount: videos.length, currentClip: currentVideoIndex, onRecord: startRecording, onStopRecord: stopRecording };

  // Single shared canvas element — MUST only exist once in the DOM
  const canvasElement = (
    <div ref={canvasWrapRef} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
      <canvas ref={canvasRef} width={state.canvasOrientation === 'portrait' ? 720 : 1280} height={state.canvasOrientation === 'portrait' ? 1280 : 720}
        style={state.canvasOrientation === 'portrait' ? { maxHeight: 'calc(100vh - 280px)', width: 'auto', margin: '0 auto', display: 'block' } : { width: '100%', maxHeight: 'calc(100vh - 280px)', display: 'block' }} />
      {state.isRecording && <div className="mx-rec-indicator"><div className="mx-rec-dot" /><span>REC</span></div>}
      <button onClick={toggleFullscreen} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,0,64,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 14, cursor: 'pointer', zIndex: 10 }}>{'\u26F6'}</button>
    </div>
  );

  const renderPanel = (key: string) => {
    switch (key) {
      case 'super-fx': return <SuperFxPanel {...panelProps} />;
      case 'effects': return <EffectsPanel {...panelProps} />;
      case 'preview': return <Panel title="$MINT MIXER">{canvasElement}</Panel>;
      case 'text': return <TextPanel {...panelProps} />;
      case 'settings': return <SettingsPanel {...panelProps} {...settingsExtra} />;
    }
  };

  return (
    <div className="mx-root">
      {/* Hidden video element */}
      {/* Video MUST NOT use display:none, opacity:0, or clip — Chromium won't decode frames */}
      <video
        ref={videoRef}
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, pointerEvents: 'none' }}
        onEnded={() => setCurrentVideoIndex(p => (p + 1) % Math.max(1, videos.length))}
        muted playsInline autoPlay
      />

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onEnded={nextAudioTrack}
      />

      {/* Video Timeline */}
      <VideoTimeline videos={videos} currentClip={currentVideoIndex} speed={state.core.speed}
        onSpeedChange={s => dispatch({ type: 'SET_CORE', key: 'speed', value: s })}
        onNext={() => { setCurrentVideoIndex(p => (p + 1) % Math.max(1, videos.length)); if (state.transition !== 'none') transitionRef.current = { active: true, progress: 0, startTime: performance.now() }; }}
        onPrev={() => { setCurrentVideoIndex(p => (p - 1 + videos.length) % Math.max(1, videos.length)); if (state.transition !== 'none') transitionRef.current = { active: true, progress: 0, startTime: performance.now() }; }}
        onSelectClip={idx => { setCurrentVideoIndex(idx); if (state.transition !== 'none') transitionRef.current = { active: true, progress: 0, startTime: performance.now() }; }} />

      {/* Audio Timeline */}
      {audioTracks.length > 0 && (
        <AudioTimeline tracks={audioTracks} currentTrack={currentAudioTrack} isPlaying={isAudioPlaying}
          onToggle={toggleAudio} onNext={nextAudioTrack} onPrev={prevAudioTrack} onSelectTrack={idx => { setCurrentAudioTrack(idx); setIsAudioPlaying(true); }} />
      )}

      {/* Desktop: columns layout */}
      <div className="mx-columns" style={{ gridTemplateColumns: '280px 1fr 280px' }}>
        <div className="mx-col mx-col-panel">
          <SuperFxPanel {...panelProps} />
          <EffectsPanel {...panelProps} />
        </div>
        <div className="mx-col mx-col-preview">
          {canvasElement}
          {/* Transport bar under preview */}
          <div style={{ width: '100%', padding: '8px 12px', borderTop: '1px solid rgba(233,30,140,0.15)', background: 'rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="mx-btn-sm" onClick={prevAudioTrack}>{'\u23EE'}</button>
                <button className="mx-btn-sm mx-btn-accent" onClick={toggleAudio} style={{ width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isAudioPlaying ? '\u23F8' : '\u25B6'}</button>
                <button className="mx-btn-sm" onClick={nextAudioTrack}>{'\u23ED'}</button>
                <span style={{ fontSize: 10, color: 'var(--muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{audioTracks[currentAudioTrack]?.title || 'No track'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {(['fill', 'cinematic', 'fit'] as const).map(mode => (
                  <button key={mode} onClick={() => dispatch({ type: 'SET', key: 'videoFit', value: mode })}
                    className={`mx-fit-btn ${state.videoFit === mode ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10 }}>
                    {mode === 'cinematic' ? 'cine' : mode}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => dispatch({ type: 'SET', key: 'chaosMode', value: !state.chaosMode })} className={`mx-fit-btn ${state.chaosMode ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10 }}>{'\u26A1'} Chaos {state.chaosMode ? 'ON' : 'OFF'}</button>
                <button onClick={() => dispatch({ type: 'SET', key: 'beatSync', value: !state.beatSync })} className={`mx-fit-btn ${state.beatSync ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10 }}>{'\u266B'} Beat {state.beatSync ? 'ON' : 'OFF'}</button>
                <button onClick={() => dispatch({ type: 'SET', key: 'lyricsMode', value: !state.lyricsMode })} className={`mx-fit-btn ${state.lyricsMode ? 'active' : ''}`} style={{ padding: '2px 8px', fontSize: 10 }}>{'\u2606'} Lyrics {state.lyricsMode ? 'ON' : 'OFF'}</button>
                <button onClick={() => dispatch({ type: 'SET', key: 'canvasOrientation', value: state.canvasOrientation === 'landscape' ? 'portrait' : 'landscape' })} className="mx-fit-btn" style={{ padding: '2px 8px', fontSize: 10 }}>{state.canvasOrientation === 'portrait' ? '9:16' : '16:9'}</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {state.isRecording
                  ? <button onClick={stopRecording} className="mx-rec-stop-btn" style={{ padding: '2px 8px', fontSize: 10 }}>{'\u23F9'} Stop Rec</button>
                  : <button onClick={startRecording} className="mx-rec-start-btn" style={{ padding: '2px 8px', fontSize: 10 }}>{'\u23FA'} Record</button>}
                <button onClick={toggleFullscreen} className="mx-fit-btn" style={{ padding: '2px 8px', fontSize: 10 }}>{'\u26F6'} Fullscreen</button>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-col mx-col-panel">
          <TextPanel {...panelProps} />
          <SettingsPanel {...panelProps} {...settingsExtra} />
        </div>
      </div>

    </div>
  );
}
