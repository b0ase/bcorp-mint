import React from 'react';
import type { TextOverlay } from '../lib/types';
import { FONT_OPTIONS } from '../lib/logos';

type TextOverlayPanelProps = {
  overlays: TextOverlay[];
  selectedTextId: string | null;
  onSelectText: (id: string | null) => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<TextOverlay>) => void;
  onRemove: (id: string) => void;
};

export default function TextOverlayPanel({ overlays, selectedTextId, onSelectText, onAdd, onUpdate, onRemove }: TextOverlayPanelProps) {
  const selected = overlays.find((o) => o.id === selectedTextId) ?? null;

  return (
    <div className="section">
      <h3>Text Overlays</h3>
      <div className="control-group">
        <button className="secondary" onClick={onAdd}>+ Add Text</button>

        {overlays.length > 0 && (
          <div className="text-overlay-list">
            {overlays.map((overlay) => (
              <div
                key={overlay.id}
                className={`text-overlay-item ${overlay.id === selectedTextId ? 'active' : ''}`}
                onClick={() => onSelectText(overlay.id)}
              >
                <span className="text-overlay-preview">
                  {overlay.text.slice(0, 20) || 'Empty'}
                </span>
                <button
                  className="image-remove-btn"
                  style={{ opacity: 1 }}
                  onClick={(e) => { e.stopPropagation(); onRemove(overlay.id); }}
                  title="Delete overlay"
                >
                  {'\u00D7'}
                </button>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <>
            <label className="control-row">
              <span>Text</span>
              <input
                type="text"
                value={selected.text}
                onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
              />
            </label>

            <label className="control-row">
              <span>Font</span>
              <select
                value={selected.fontFamily}
                onChange={(e) => onUpdate(selected.id, { fontFamily: e.target.value })}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>

            <label className="control-row">
              <span>Size</span>
              <input
                type="range"
                min="12"
                max="200"
                step="1"
                value={selected.fontSize}
                onChange={(e) => onUpdate(selected.id, { fontSize: Number(e.target.value) })}
              />
              <span className="small" style={{ minWidth: 28, textAlign: 'right' }}>{selected.fontSize}</span>
            </label>

            <label className="control-row">
              <span>Weight</span>
              <input
                type="range"
                min="100"
                max="900"
                step="100"
                value={selected.fontWeight}
                onChange={(e) => onUpdate(selected.id, { fontWeight: Number(e.target.value) })}
              />
              <span className="small" style={{ minWidth: 28, textAlign: 'right' }}>{selected.fontWeight}</span>
            </label>

            <label className="control-row">
              <span>Color</span>
              <input
                type="color"
                value={selected.color}
                onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
              />
            </label>

            <label className="control-row">
              <span>Spacing</span>
              <input
                type="range"
                min="-5"
                max="20"
                step="0.5"
                value={selected.letterSpacing}
                onChange={(e) => onUpdate(selected.id, { letterSpacing: Number(e.target.value) })}
              />
            </label>

            <label className="control-row">
              <span>Line H</span>
              <input
                type="range"
                min="0.8"
                max="3"
                step="0.05"
                value={selected.lineHeight}
                onChange={(e) => onUpdate(selected.id, { lineHeight: Number(e.target.value) })}
              />
            </label>

            <label className="control-row">
              <span>Align</span>
              <div className="text-align-group">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    className={`text-align-btn ${selected.align === a ? 'active' : ''}`}
                    onClick={() => onUpdate(selected.id, { align: a })}
                  >
                    {a === 'left' ? '\u2190' : a === 'right' ? '\u2192' : '\u2194'}
                  </button>
                ))}
              </div>
            </label>

            <label className="control-row">
              <span>Width</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.01"
                value={selected.width}
                onChange={(e) => onUpdate(selected.id, { width: Number(e.target.value) })}
              />
            </label>

            <label className="control-row">
              <span>Rotation</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={selected.rotation}
                onChange={(e) => onUpdate(selected.id, { rotation: Number(e.target.value) })}
              />
              <span className="small" style={{ minWidth: 28, textAlign: 'right' }}>{selected.rotation}&deg;</span>
            </label>

            <label className="control-row">
              <span>Opacity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selected.opacity}
                onChange={(e) => onUpdate(selected.id, { opacity: Number(e.target.value) })}
              />
            </label>

            <label className="control-row">
              <span>BG Color</span>
              <input
                type="color"
                value={selected.backgroundColor}
                onChange={(e) => onUpdate(selected.id, { backgroundColor: e.target.value })}
              />
            </label>

            <label className="control-row">
              <span>BG Opacity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selected.backgroundOpacity}
                onChange={(e) => onUpdate(selected.id, { backgroundOpacity: Number(e.target.value) })}
              />
            </label>

            <label className="control-row">
              <span>Visible</span>
              <input
                type="checkbox"
                checked={selected.visible}
                onChange={(e) => onUpdate(selected.id, { visible: e.target.checked })}
              />
            </label>

            <button
              className="ghost"
              style={{ color: 'var(--danger)' }}
              onClick={() => onRemove(selected.id)}
            >
              Delete Overlay
            </button>
          </>
        )}
      </div>
    </div>
  );
}
