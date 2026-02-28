import React, { useState } from 'react';
import type { Clef, KeySignature, MusicScore, MusicTool, NoteDuration, TimeSignature } from '../lib/music-types';

type Props = {
  score: MusicScore;
  selectedStaffId: string | null;
  selectedMeasureIdx: number | null;
  selectedNoteIdx: number | null;
  currentTool: MusicTool;
  currentDuration: NoteDuration;
  dotted: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSetTool: (tool: MusicTool) => void;
  onSetDuration: (duration: NoteDuration) => void;
  onSetDotted: (dotted: boolean) => void;
  onSetTitle: (title: string) => void;
  onSetComposer: (composer: string) => void;
  onSetKeySignature: (key: KeySignature) => void;
  onSetTimeSignature: (ts: TimeSignature) => void;
  onSetTempo: (tempo: number) => void;
  onAddStaff: (name?: string, clef?: Clef) => void;
  onRemoveStaff: (staffId: string) => void;
  onUpdateStaffClef: (staffId: string, clef: Clef) => void;
  onUpdateStaffName: (staffId: string, name: string) => void;
  onAddMeasure: (staffId?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportPng: () => string | null;
  onExportSvg: () => string;
};

const TOOLS: { value: MusicTool; label: string; title: string }[] = [
  { value: 'select', label: 'Sel', title: 'Select' },
  { value: 'note', label: 'Note', title: 'Place note' },
  { value: 'rest', label: 'Rest', title: 'Place rest' },
  { value: 'eraser', label: 'Erase', title: 'Eraser' },
];

const DURATIONS: { value: NoteDuration; label: string; symbol: string }[] = [
  { value: 'whole', label: 'Whole', symbol: '\uD834\uDD5D' },
  { value: 'half', label: 'Half', symbol: '\uD834\uDD5E' },
  { value: 'quarter', label: 'Quarter', symbol: '\uD834\uDD5F' },
  { value: 'eighth', label: '8th', symbol: '\uD834\uDD60' },
  { value: 'sixteenth', label: '16th', symbol: '\uD834\uDD61' },
];

const KEY_SIGNATURES: KeySignature[] = [
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#',
];

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
  { value: 'alto', label: 'Alto' },
  { value: 'tenor', label: 'Tenor' },
];

export default function MusicPanel({
  score, selectedStaffId, selectedMeasureIdx, selectedNoteIdx,
  currentTool, currentDuration, dotted, canUndo, canRedo,
  onSetTool, onSetDuration, onSetDotted, onSetTitle, onSetComposer,
  onSetKeySignature, onSetTimeSignature, onSetTempo,
  onAddStaff, onRemoveStaff, onUpdateStaffClef, onUpdateStaffName,
  onAddMeasure, onUndo, onRedo, onExportPng, onExportSvg
}: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [stampResult, setStampResult] = useState('');

  const handleExportPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = onExportPng();
      if (dataUrl) {
        await window.mint.exportMintPng({ dataUrl, defaultName: score.title || 'music-score' });
      }
    } catch (err) {
      console.error('Export PNG failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSvg = async () => {
    setIsExporting(true);
    try {
      const svgContent = onExportSvg();
      await window.mint.exportMintSvg({ svgContent, defaultName: score.title || 'music-score' });
    } catch (err) {
      console.error('Export SVG failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleStampScore = async () => {
    setStampResult('');
    try {
      const dataUrl = onExportPng();
      if (!dataUrl) throw new Error('Export failed');
      const filePath = await window.mint.exportMintPng({ dataUrl, defaultName: score.title || 'music-stamp' });
      if (!filePath) return;
      const { hash } = await window.mint.hashFile(filePath);
      const timestamp = new Date().toISOString();
      const receipt = {
        id: crypto.randomUUID(),
        path: `$STAMP/MUSIC/${score.title || 'SCORE'}`,
        hash,
        algorithm: 'sha256' as const,
        sourceFile: filePath.split('/').pop() || 'score.png',
        sourceSize: 0,
        timestamp,
        txid: null,
        tokenId: null,
        metadata: {},
      };
      await window.mint.saveStampReceipt(JSON.stringify(receipt));
      try {
        const hasKey = await window.mint.keystoreHasKey();
        if (hasKey) {
          const { txid } = await window.mint.inscribeStamp({ path: receipt.path, hash, timestamp });
          await window.mint.updateStampReceipt(receipt.id, { txid });
          setStampResult(`Inscribed: ${txid.slice(0, 12)}...`);
        } else {
          setStampResult(`Hashed: ${hash.slice(0, 16)}... (no key)`);
        }
      } catch {
        setStampResult(`Hashed: ${hash.slice(0, 16)}... (local only)`);
      }
    } catch (err) {
      setStampResult(`Failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleMintToken = async () => {
    setStampResult('');
    try {
      const dataUrl = onExportPng();
      if (!dataUrl) throw new Error('Export failed');
      const match = dataUrl.match(/^data:(.+);base64,(.*)$/) || dataUrl.match(/^data:(.+);charset=utf-8,(.*)$/);
      const filePath = await window.mint.exportMintPng({ dataUrl, defaultName: score.title || 'music-token' });
      if (!filePath) return;
      const { hash } = await window.mint.hashFile(filePath);
      const { tokenId } = await window.mint.mintStampToken({
        path: `$STAMP/MUSIC/${score.title || 'TOKEN'}`,
        hash,
        name: score.title || 'MUSIC TOKEN',
        iconDataB64: match?.[2],
        iconContentType: match?.[1],
      });
      setStampResult(`Minted: ${tokenId}`);
    } catch (err) {
      setStampResult(`Failed: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <aside className="panel right-panel mint-panel">
      <h2>Music Editor</h2>

      {/* Score Info */}
      <div className="section">
        <h3>Score</h3>
        <div className="control-group">
          <label className="control-row">
            <span>Title</span>
            <input type="text" value={score.title} onChange={(e) => onSetTitle(e.target.value)} />
          </label>
          <label className="control-row">
            <span>Composer</span>
            <input type="text" value={score.composer} onChange={(e) => onSetComposer(e.target.value)} placeholder="Composer..." />
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="control-row" style={{ gap: 4, flexWrap: 'wrap' }}>
        <button className="ghost" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">Undo</button>
        <button className="ghost" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">Redo</button>
      </div>

      {/* Tool Selector */}
      <div className="section">
        <h3>Tool</h3>
        <div className="mode-toggle" style={{ marginBottom: 8 }}>
          {TOOLS.map((t) => (
            <button
              key={t.value}
              className={`mode-toggle-btn ${currentTool === t.value ? 'active' : ''}`}
              onClick={() => onSetTool(t.value)}
              title={t.title}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Picker */}
      <div className="section">
        <h3>Duration</h3>
        <div className="mode-toggle" style={{ marginBottom: 4 }}>
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              className={`mode-toggle-btn ${currentDuration === d.value ? 'active' : ''}`}
              onClick={() => onSetDuration(d.value)}
              title={d.label}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <label className="control-row">
          <span>Dotted</span>
          <input type="checkbox" checked={dotted} onChange={(e) => onSetDotted(e.target.checked)} />
        </label>
      </div>

      {/* Score Settings */}
      <div className="section">
        <h3>Settings</h3>
        <div className="control-group">
          <label className="control-row">
            <span>Key</span>
            <select value={score.keySignature} onChange={(e) => onSetKeySignature(e.target.value as KeySignature)}>
              {KEY_SIGNATURES.map((k) => (
                <option key={k} value={k}>{k} Major</option>
              ))}
            </select>
          </label>
          <label className="control-row">
            <span>Time</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <select
                value={score.timeSignature.beats}
                onChange={(e) => onSetTimeSignature({ ...score.timeSignature, beats: Number(e.target.value) })}
                style={{ width: 50 }}
              >
                {[2, 3, 4, 5, 6, 7, 9, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>/</span>
              <select
                value={score.timeSignature.beatType}
                onChange={(e) => onSetTimeSignature({ ...score.timeSignature, beatType: Number(e.target.value) })}
                style={{ width: 50 }}
              >
                {[2, 4, 8, 16].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="control-row">
            <span>Tempo</span>
            <input
              type="range"
              min={40}
              max={240}
              step={1}
              value={score.tempo}
              onChange={(e) => onSetTempo(Number(e.target.value))}
            />
            <span className="small" style={{ minWidth: 30, textAlign: 'right' }}>{score.tempo}</span>
          </label>
        </div>
      </div>

      {/* Staves */}
      <div className="section">
        <h3>Staves ({score.staves.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {score.staves.map((staff) => (
            <div key={staff.id} className="control-group" style={{ padding: '6px 8px', background: selectedStaffId === staff.id ? 'rgba(255,45,120,0.08)' : 'transparent', borderRadius: 6 }}>
              <div className="control-row">
                <input
                  type="text"
                  value={staff.name}
                  onChange={(e) => onUpdateStaffName(staff.id, e.target.value)}
                  style={{ flex: 1, fontSize: 12 }}
                />
                <select
                  value={staff.clef}
                  onChange={(e) => onUpdateStaffClef(staff.id, e.target.value as Clef)}
                  style={{ width: 80, fontSize: 11 }}
                >
                  {CLEFS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {score.staves.length > 1 && (
                  <button
                    className="ghost"
                    style={{ fontSize: 10, padding: '2px 6px', color: 'var(--danger)' }}
                    onClick={() => onRemoveStaff(staff.id)}
                    title="Remove staff"
                  >
                    x
                  </button>
                )}
              </div>
              <div className="small" style={{ marginTop: 2 }}>{staff.measures.length} measures</div>
            </div>
          ))}
        </div>
        <div className="control-row" style={{ gap: 4, marginTop: 6 }}>
          <button className="secondary" onClick={() => onAddStaff()} style={{ flex: 1 }}>+ Add Staff</button>
          <button className="secondary" onClick={() => onAddMeasure()} style={{ flex: 1 }}>+ Add Measure</button>
        </div>
      </div>

      {/* Export & Stamp */}
      <div className="section">
        <h3>Export</h3>
        <div className="control-row" style={{ gap: 4 }}>
          <button className="secondary" onClick={handleExportPng} disabled={isExporting} style={{ flex: 1 }}>PNG</button>
          <button className="secondary" onClick={handleExportSvg} disabled={isExporting} style={{ flex: 1 }}>SVG</button>
        </div>
        <div className="control-row" style={{ gap: 4, marginTop: 4 }}>
          <button className="secondary" onClick={handleStampScore} style={{ flex: 1 }}>
            Stamp & Inscribe
          </button>
          <button onClick={handleMintToken} style={{ flex: 1 }}>
            Mint Token
          </button>
        </div>
        {stampResult && <div className="small" style={{ marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{stampResult}</div>}
      </div>
    </aside>
  );
}
