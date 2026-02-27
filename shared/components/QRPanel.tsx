import React, { useCallback, useRef, useState } from 'react';
import type {
  QRContentType,
  QRErrorCorrection,
  QRModuleStyle,
  QRFinderStyle,
  QRProject,
  QRBatchConfig,
} from '@shared/lib/qr-types';
import { QR_CONTENT_LABELS, QR_CONTENT_FIELDS } from '@shared/lib/qr-types';
import type { QRMatrix } from '@shared/lib/qr-encoder';
import { encodeQR } from '@shared/lib/qr-encoder';

type Props = {
  project: QRProject;
  dataString: string;
  version: number;
  batchDataStrings: string[];
  onSetContentType: (type: QRContentType) => void;
  onUpdateContentField: (key: string, value: string) => void;
  onSetStyle: (style: Partial<QRProject['style']>) => void;
  onSetLogo: (logo: QRProject['logo']) => void;
  onUpdateLogo: (update: Partial<NonNullable<QRProject['logo']>>) => void;
  onSetSize: (size: number) => void;
  onSetMargin: (margin: number) => void;
  onSetErrorCorrection: (ec: QRErrorCorrection) => void;
  onSetBatch: (batch: Partial<QRBatchConfig>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportPng: () => Promise<Blob | null>;
  onExportSvg: () => string;
  onExportBatchPng: () => Promise<Blob[]>;
  onCopyToClipboard: () => Promise<void>;
  renderToCanvas: (canvas: HTMLCanvasElement, mat?: QRMatrix, outputSize?: number) => void;
};

const CONTENT_TYPES: QRContentType[] = ['url', 'text', 'wallet', 'token', 'vcard', 'wifi', 'email'];
const MODULE_STYLES: { value: QRModuleStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
  { value: 'diamond', label: 'Diamond' },
];
const FINDER_STYLES: { value: QRFinderStyle; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
];
const EC_OPTIONS: { value: QRErrorCorrection; label: string }[] = [
  { value: 'L', label: 'L (7%)' },
  { value: 'M', label: 'M (15%)' },
  { value: 'Q', label: 'Q (25%)' },
  { value: 'H', label: 'H (30%)' },
];

export default function QRPanel({
  project,
  dataString,
  version,
  batchDataStrings,
  onSetContentType,
  onUpdateContentField,
  onSetStyle,
  onSetLogo,
  onUpdateLogo,
  onSetSize,
  onSetMargin,
  onSetErrorCorrection,
  onSetBatch,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportPng,
  onExportSvg,
  onExportBatchPng,
  onCopyToClipboard,
  renderToCanvas,
}: Props) {
  const [batchExpanded, setBatchExpanded] = useState(false);
  const [logoExpanded, setLogoExpanded] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fields = QR_CONTENT_FIELDS[project.contentType];

  // --- Logo upload ---
  const handleLogoUpload = useCallback(() => {
    logoInputRef.current?.click();
  }, []);

  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onSetLogo({
        src: reader.result as string,
        size: 0.15,
        padShape: 'square',
        padColor: '#000000',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [onSetLogo]);

  // --- Export handlers ---
  const handleExportPng = useCallback(async () => {
    const blob = await onExportPng();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [onExportPng]);

  const handleExportSvg = useCallback(() => {
    const svg = onExportSvg();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [onExportSvg]);

  const handleExportBatch = useCallback(async () => {
    const blobs = await onExportBatchPng();
    for (let i = 0; i < blobs.length; i++) {
      const url = URL.createObjectURL(blobs[i]);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-batch-${String(i + 1).padStart(3, '0')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [onExportBatchPng]);

  // --- CSV import ---
  const handleCsvImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = text.split('\n').map(r => r.trim()).filter(Boolean);
      onSetBatch({ csvRows: rows, mode: 'csv' });
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [onSetBatch]);

  const csvInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="panel right-panel qr-panel">
      <div className="qr-panel-header">
        <h2>QR Code</h2>
        <div className="qr-undo-redo">
          <button className="ghost" onClick={onUndo} disabled={!canUndo} title="Undo">&#x21B6;</button>
          <button className="ghost" onClick={onRedo} disabled={!canRedo} title="Redo">&#x21B7;</button>
        </div>
      </div>

      {/* Content Type */}
      <div className="section">
        <h3>Content</h3>
        <div className="control-group">
          <label className="control-row">
            <span>Type</span>
            <select
              value={project.contentType}
              onChange={e => onSetContentType(e.target.value as QRContentType)}
            >
              {CONTENT_TYPES.map(t => (
                <option key={t} value={t}>{QR_CONTENT_LABELS[t]}</option>
              ))}
            </select>
          </label>

          {fields.map(field => (
            <label className="control-row" key={field.key}>
              <span>{field.label}</span>
              {field.type === 'textarea' ? (
                <textarea
                  value={project.content[field.key] || ''}
                  onChange={e => onUpdateContentField(field.key, e.target.value)}
                  rows={3}
                />
              ) : field.type === 'select' ? (
                <select
                  value={project.content[field.key] || field.options?.[0] || ''}
                  onChange={e => onUpdateContentField(field.key, e.target.value)}
                >
                  {field.options?.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={project.content[field.key] || ''}
                  onChange={e => onUpdateContentField(field.key, e.target.value)}
                  placeholder={field.label}
                />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Visual Style */}
      <div className="section">
        <h3>Style</h3>
        <div className="control-group">
          <label className="control-row">
            <span>Foreground</span>
            <input
              type="color"
              value={project.style.foreground}
              onChange={e => onSetStyle({ foreground: e.target.value })}
            />
          </label>
          <label className="control-row">
            <span>Background</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="color"
                value={project.style.background === 'transparent' ? '#000000' : project.style.background}
                onChange={e => onSetStyle({ background: e.target.value })}
              />
              <button
                className="ghost"
                style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={() => onSetStyle({ background: 'transparent' })}
              >
                Clear
              </button>
            </div>
          </label>
          <label className="control-row">
            <span>Modules</span>
            <select
              value={project.style.moduleStyle}
              onChange={e => onSetStyle({ moduleStyle: e.target.value as QRModuleStyle })}
            >
              {MODULE_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="control-row">
            <span>Finders</span>
            <select
              value={project.style.finderStyle}
              onChange={e => onSetStyle({ finderStyle: e.target.value as QRFinderStyle })}
            >
              {FINDER_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Size & EC */}
      <div className="section">
        <h3>Output</h3>
        <div className="control-group">
          <label className="control-row">
            <span>Size</span>
            <input
              type="range"
              min="256"
              max="2048"
              step="64"
              value={project.size}
              onChange={e => onSetSize(Number(e.target.value))}
            />
          </label>
          <label className="control-row">
            <span>Margin</span>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={project.margin}
              onChange={e => onSetMargin(Number(e.target.value))}
            />
          </label>
          <label className="control-row">
            <span>Error Correction</span>
            <select
              value={project.errorCorrection}
              onChange={e => onSetErrorCorrection(e.target.value as QRErrorCorrection)}
            >
              {EC_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Logo */}
      <div className="section">
        <h3
          className="section-toggle"
          onClick={() => setLogoExpanded(prev => !prev)}
        >
          Logo {logoExpanded ? '\u25BE' : '\u25B8'}
        </h3>
        {logoExpanded && (
          <div className="control-group">
            {project.logo ? (
              <>
                <div className="qr-logo-preview">
                  <img src={project.logo.src} alt="Logo" />
                  <button className="ghost" onClick={() => onSetLogo(null)}>Remove</button>
                </div>
                <label className="control-row">
                  <span>Size</span>
                  <input
                    type="range"
                    min="0.05"
                    max="0.30"
                    step="0.01"
                    value={project.logo.size}
                    onChange={e => onUpdateLogo({ size: Number(e.target.value) })}
                  />
                </label>
                <label className="control-row">
                  <span>Pad Shape</span>
                  <select
                    value={project.logo.padShape}
                    onChange={e => onUpdateLogo({ padShape: e.target.value as 'circle' | 'square' })}
                  >
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                  </select>
                </label>
                <label className="control-row">
                  <span>Pad Color</span>
                  <input
                    type="color"
                    value={project.logo.padColor}
                    onChange={e => onUpdateLogo({ padColor: e.target.value })}
                  />
                </label>
              </>
            ) : (
              <button className="secondary" onClick={handleLogoUpload}>
                Upload Logo
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleLogoFile}
            />
          </div>
        )}
      </div>

      {/* Batch */}
      <div className="section">
        <h3
          className="section-toggle"
          onClick={() => setBatchExpanded(prev => !prev)}
        >
          Batch {batchExpanded ? '\u25BE' : '\u25B8'}
        </h3>
        {batchExpanded && (
          <div className="control-group">
            <label className="control-row">
              <span>Enabled</span>
              <input
                type="checkbox"
                checked={project.batch.enabled}
                onChange={e => onSetBatch({ enabled: e.target.checked })}
              />
            </label>
            {project.batch.enabled && (
              <>
                <label className="control-row">
                  <span>Mode</span>
                  <select
                    value={project.batch.mode}
                    onChange={e => onSetBatch({ mode: e.target.value as 'serial' | 'csv' })}
                  >
                    <option value="serial">Serial Range</option>
                    <option value="csv">CSV Import</option>
                  </select>
                </label>
                {project.batch.mode === 'serial' ? (
                  <>
                    <label className="control-row">
                      <span>Prefix</span>
                      <input
                        type="text"
                        value={project.batch.prefix}
                        onChange={e => onSetBatch({ prefix: e.target.value })}
                      />
                    </label>
                    <label className="control-row">
                      <span>Start</span>
                      <input
                        type="number"
                        min="1"
                        value={project.batch.start}
                        onChange={e => onSetBatch({ start: Number(e.target.value) })}
                      />
                    </label>
                    <label className="control-row">
                      <span>End</span>
                      <input
                        type="number"
                        min="1"
                        value={project.batch.end}
                        onChange={e => onSetBatch({ end: Number(e.target.value) })}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <button className="secondary" onClick={() => csvInputRef.current?.click()}>
                      Import CSV
                    </button>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,.txt"
                      style={{ display: 'none' }}
                      onChange={handleCsvImport}
                    />
                    {project.batch.csvRows.length > 0 && (
                      <div className="small" style={{ opacity: 0.6 }}>
                        {project.batch.csvRows.length} rows loaded
                      </div>
                    )}
                  </>
                )}
                <div className="small" style={{ opacity: 0.5, marginTop: 4 }}>
                  {batchDataStrings.length} QR codes to generate
                </div>

                {/* Batch preview grid */}
                {batchDataStrings.length > 0 && batchDataStrings.length <= 20 && (
                  <div className="qr-batch-grid">
                    {batchDataStrings.slice(0, 20).map((data, i) => (
                      <BatchThumbnail key={i} data={data} ec={project.errorCorrection} renderToCanvas={renderToCanvas} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="section">
        <h3>Export</h3>
        <div className="control-group" style={{ gap: 6 }}>
          <button onClick={handleExportPng}>Export PNG</button>
          <button className="secondary" onClick={handleExportSvg}>Export SVG</button>
          <button className="secondary" onClick={onCopyToClipboard}>Copy to Clipboard</button>
          {project.batch.enabled && batchDataStrings.length > 0 && (
            <button onClick={handleExportBatch}>
              Export Batch ({batchDataStrings.length} PNGs)
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

// --- Batch thumbnail component ---

function BatchThumbnail({
  data,
  ec,
  renderToCanvas,
}: {
  data: string;
  ec: QRErrorCorrection;
  renderToCanvas: (canvas: HTMLCanvasElement, mat?: QRMatrix, outputSize?: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { matrix } = encodeQR(data, ec);
    renderToCanvas(canvas, matrix, 64);
  }, [data, ec, renderToCanvas]);

  return (
    <canvas
      ref={ref}
      className="qr-batch-thumb"
      title={data}
    />
  );
}
