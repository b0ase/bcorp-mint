'use client';

import React, { useMemo, useState } from 'react';
import {
  defaultDesignerConfig,
  designerLogoToAsset,
  FONT_OPTIONS,
  generateDesignerLogo,
  type LogoBgShape,
  type LogoBorderStyle,
  type LogoDesignerConfig,
  type LogoFillMode,
  type LogoLayout,
} from '../lib/logos';
import type { LogoAsset } from '../lib/types';

type LogoDesignerProps = {
  onSave: (logo: LogoAsset) => void;
  onClose: () => void;
};

const LAYOUTS: { value: LogoLayout; label: string }[] = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'circular', label: 'Circular' },
  { value: 'stacked', label: 'Stacked' },
  { value: 'badge', label: 'Badge' },
];

type PreviewBg = 'dark' | 'light' | 'split';

export default function LogoDesigner({ onSave, onClose }: LogoDesignerProps) {
  const [config, setConfig] = useState<LogoDesignerConfig>(defaultDesignerConfig);
  const [previewBg, setPreviewBg] = useState<PreviewBg>('dark');

  const patch = (p: Partial<LogoDesignerConfig>) => setConfig((prev) => ({ ...prev, ...p }));

  const svgString = useMemo(() => generateDesignerLogo(config), [config]);

  const handleSave = () => {
    const logo = designerLogoToAsset(config);
    onSave(logo);
  };

  const darkBg = '#0a0a0a';
  const lightBg = '#f0f0f0';

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer" onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Logo Designer</h2>
          <button className="ghost" onClick={onClose}>&times;</button>
        </div>

        <div className="logo-designer-body">
          {/* Controls */}
          <div className="logo-designer-controls">
            <div className="section">
              <h3>Layout</h3>
              <div className="logo-layout-grid">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    className={`logo-layout-card ${config.layout === l.value ? 'active' : ''}`}
                    onClick={() => patch({ layout: l.value })}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="section">
              <h3>Text</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Primary</span>
                  <input
                    type="text"
                    value={config.text}
                    onChange={(e) => patch({ text: e.target.value })}
                  />
                </label>
                <label className="control-row">
                  <span>Subtitle</span>
                  <input
                    type="text"
                    value={config.subtitleText}
                    onChange={(e) => patch({ subtitleText: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="section">
              <h3>Typography</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Font</span>
                  <select value={config.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })}>
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="control-row">
                  <span>Weight</span>
                  <input type="range" min="300" max="900" step="100" value={config.fontWeight} onChange={(e) => patch({ fontWeight: Number(e.target.value) })} />
                </label>
                <label className="control-row">
                  <span>Size</span>
                  <input type="range" min="40" max="220" step="2" value={config.fontSize} onChange={(e) => patch({ fontSize: Number(e.target.value) })} />
                </label>
                <label className="control-row">
                  <span>Spacing</span>
                  <input type="range" min="0" max="40" step="1" value={config.letterSpacing} onChange={(e) => patch({ letterSpacing: Number(e.target.value) })} />
                </label>
              </div>
            </div>

            <div className="section">
              <h3>Colors</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Text</span>
                  <input type="color" value={config.color} onChange={(e) => patch({ color: e.target.value })} />
                </label>
                <label className="control-row">
                  <span>Subtitle</span>
                  <input type="color" value={config.subtitleColor} onChange={(e) => patch({ subtitleColor: e.target.value })} />
                </label>
                <label className="control-row">
                  <span>Decor</span>
                  <input type="color" value={config.borderColor} onChange={(e) => patch({ borderColor: e.target.value })} />
                </label>
              </div>
            </div>

            <div className="section">
              <h3>Fill & Stroke</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Fill</span>
                  <select value={config.fillMode} onChange={(e) => patch({ fillMode: e.target.value as LogoFillMode })}>
                    <option value="solid">Solid</option>
                    <option value="outline">Outline</option>
                  </select>
                </label>
                {config.fillMode === 'solid' && (
                  <label className="control-row">
                    <span>+ Stroke</span>
                    <input type="checkbox" checked={config.strokeEnabled} onChange={(e) => patch({ strokeEnabled: e.target.checked })} />
                  </label>
                )}
                {(config.fillMode === 'outline' || config.strokeEnabled) && (
                  <>
                    <label className="control-row">
                      <span>Stroke Color</span>
                      <input type="color" value={config.strokeColor} onChange={(e) => patch({ strokeColor: e.target.value })} />
                    </label>
                    <label className="control-row">
                      <span>Stroke Width</span>
                      <input type="range" min="0.5" max="16" step="0.5" value={config.strokeWidth} onChange={(e) => patch({ strokeWidth: Number(e.target.value) })} />
                    </label>
                  </>
                )}
                <label className="control-row">
                  <span>Opacity</span>
                  <input type="range" min="0.1" max="1" step="0.05" value={config.opacity} onChange={(e) => patch({ opacity: Number(e.target.value) })} />
                </label>
              </div>
            </div>

            <div className="section">
              <h3>Outer Stroke</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Enabled</span>
                  <input type="checkbox" checked={config.outerStrokeEnabled} onChange={(e) => patch({ outerStrokeEnabled: e.target.checked })} />
                </label>
                {config.outerStrokeEnabled && (
                  <>
                    <label className="control-row">
                      <span>Color</span>
                      <input type="color" value={config.outerStrokeColor} onChange={(e) => patch({ outerStrokeColor: e.target.value })} />
                    </label>
                    <label className="control-row">
                      <span>Width</span>
                      <input type="range" min="2" max="30" step="1" value={config.outerStrokeWidth} onChange={(e) => patch({ outerStrokeWidth: Number(e.target.value) })} />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="section">
              <h3>Background</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Enabled</span>
                  <input type="checkbox" checked={config.bgEnabled} onChange={(e) => patch({ bgEnabled: e.target.checked })} />
                </label>
                {config.bgEnabled && (
                  <>
                    <label className="control-row">
                      <span>Color</span>
                      <input type="color" value={config.bgColor} onChange={(e) => patch({ bgColor: e.target.value })} />
                    </label>
                    <label className="control-row">
                      <span>Opacity</span>
                      <input type="range" min="0.05" max="1" step="0.05" value={config.bgOpacity} onChange={(e) => patch({ bgOpacity: Number(e.target.value) })} />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="section">
              <h3>Background Shape</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Shape</span>
                  <select value={config.bgShape} onChange={(e) => patch({ bgShape: e.target.value as LogoBgShape })}>
                    <option value="none">None</option>
                    <option value="rect">Rectangle</option>
                    <option value="circle">Circle</option>
                    <option value="diamond">Diamond</option>
                    <option value="star">Star</option>
                    <option value="hexagon">Hexagon</option>
                  </select>
                </label>
                {config.bgShape !== 'none' && (
                  <>
                    <label className="control-row">
                      <span>Color</span>
                      <input type="color" value={config.bgShapeColor} onChange={(e) => patch({ bgShapeColor: e.target.value })} />
                    </label>
                    <label className="control-row">
                      <span>Opacity</span>
                      <input type="range" min="0.05" max="1" step="0.05" value={config.bgShapeOpacity} onChange={(e) => patch({ bgShapeOpacity: Number(e.target.value) })} />
                    </label>
                    <label className="control-row">
                      <span>Scale</span>
                      <input type="range" min="0.5" max="1.5" step="0.05" value={config.bgShapeScale} onChange={(e) => patch({ bgShapeScale: Number(e.target.value) })} />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="section">
              <h3>Transform</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Rotation</span>
                  <input type="range" min="-45" max="45" step="1" value={config.rotation} onChange={(e) => patch({ rotation: Number(e.target.value) })} />
                </label>
                <label className="control-row">
                  <span>Skew X</span>
                  <input type="range" min="-30" max="30" step="1" value={config.skewX} onChange={(e) => patch({ skewX: Number(e.target.value) })} />
                </label>
                <label className="control-row">
                  <span>Skew Y</span>
                  <input type="range" min="-30" max="30" step="1" value={config.skewY} onChange={(e) => patch({ skewY: Number(e.target.value) })} />
                </label>
                <label className="control-row">
                  <span>Scale X</span>
                  <input type="range" min="0.5" max="2" step="0.05" value={config.scaleX} onChange={(e) => patch({ scaleX: Number(e.target.value) })} />
                </label>
                <label className="control-row">
                  <span>Scale Y</span>
                  <input type="range" min="0.5" max="2" step="0.05" value={config.scaleY} onChange={(e) => patch({ scaleY: Number(e.target.value) })} />
                </label>
                <div className="control-row">
                  <button className="ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => patch({ rotation: 0, skewX: 0, skewY: 0, scaleX: 1, scaleY: 1 })}>
                    Reset Transform
                  </button>
                </div>
              </div>
            </div>

            <div className="section">
              <h3>Shadow</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Enabled</span>
                  <input type="checkbox" checked={config.shadowEnabled} onChange={(e) => patch({ shadowEnabled: e.target.checked })} />
                </label>
                {config.shadowEnabled && (
                  <>
                    <label className="control-row">
                      <span>Blur</span>
                      <input type="range" min="1" max="20" step="1" value={config.shadowBlur} onChange={(e) => patch({ shadowBlur: Number(e.target.value) })} />
                    </label>
                    <label className="control-row">
                      <span>Color</span>
                      <input type="color" value={config.shadowColor} onChange={(e) => patch({ shadowColor: e.target.value })} />
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="section">
              <h3>Decorations</h3>
              <div className="control-group">
                <label className="control-row">
                  <span>Border</span>
                  <input type="checkbox" checked={config.border} onChange={(e) => patch({ border: e.target.checked })} />
                </label>
                {config.border && (
                  <>
                    <label className="control-row">
                      <span>Style</span>
                      <select value={config.borderStyle} onChange={(e) => patch({ borderStyle: e.target.value as LogoBorderStyle })}>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="double">Double</option>
                      </select>
                    </label>
                    <label className="control-row">
                      <span>Width</span>
                      <input type="range" min="1" max="8" step="0.5" value={config.borderWidth} onChange={(e) => patch({ borderWidth: Number(e.target.value) })} />
                    </label>
                  </>
                )}
                <label className="control-row">
                  <span>Underline</span>
                  <input type="checkbox" checked={config.underline} onChange={(e) => patch({ underline: e.target.checked })} />
                </label>
                <label className="control-row">
                  <span>Dots</span>
                  <input type="checkbox" checked={config.dots} onChange={(e) => patch({ dots: e.target.checked })} />
                </label>
                <label className="control-row">
                  <span>Stars</span>
                  <input type="checkbox" checked={config.stars} onChange={(e) => patch({ stars: e.target.checked })} />
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="logo-designer-preview">
            {previewBg === 'split' ? (
              <div className="logo-preview-split">
                <div className="logo-preview-pane" style={{ background: darkBg }}>
                  <div dangerouslySetInnerHTML={{ __html: svgString }} />
                </div>
                <div className="logo-preview-pane" style={{ background: lightBg }}>
                  <div dangerouslySetInnerHTML={{ __html: svgString }} />
                </div>
              </div>
            ) : (
              <div
                className="logo-preview-pane full"
                style={{ background: previewBg === 'dark' ? darkBg : lightBg }}
              >
                <div dangerouslySetInnerHTML={{ __html: svgString }} />
              </div>
            )}
            <div className="logo-preview-tabs">
              {(['dark', 'light', 'split'] as PreviewBg[]).map((bg) => (
                <button
                  key={bg}
                  className={`logo-preview-tab ${previewBg === bg ? 'active' : ''}`}
                  onClick={() => setPreviewBg(bg)}
                >
                  {bg.charAt(0).toUpperCase() + bg.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="logo-designer-footer">
          <span className="small">
            {config.layout} / {config.fillMode}{config.strokeEnabled ? '+stroke' : ''} / {config.text || 'LOGO'}
            {config.skewX || config.skewY ? ` / skew(${config.skewX}, ${config.skewY})` : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary" onClick={onClose}>Cancel</button>
            <button onClick={handleSave}>Save Logo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
