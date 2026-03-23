import React, { useCallback, useEffect, useState } from 'react';
import { COLOR_SCHEMES, MINT_TEMPLATES, type ColorScheme } from '../lib/mint-defaults';
import type { MintBlendMode, MintDocument, MintLayer, MintLayerConfig, MintLayerTransform } from '../lib/types';
import LayerList from './LayerList';
import PatternControls from './PatternControls';

type Props = {
  doc: MintDocument;
  selectedLayer: MintLayer | null;
  selectedLayerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  uvMode: boolean;
  onAddLayer: (type: MintLayerConfig['type']) => void;
  onRemoveLayer: (id: string) => void;
  onReorderLayer: (id: string, newIndex: number) => void;
  onUpdateConfig: (id: string, patch: Record<string, unknown>) => void;
  onUpdateMeta: (id: string, patch: { name?: string; visible?: boolean; locked?: boolean; opacity?: number; blendMode?: MintBlendMode; uvOnly?: boolean }) => void;
  onUpdateTransform: (id: string, patch: Partial<MintLayerTransform>) => void;
  onDuplicateLayer: (id: string) => void;
  onSelectLayer: (id: string | null) => void;
  onSetCanvasSize: (width: number, height: number) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetDocMeta: (patch: Partial<Pick<MintDocument, 'name' | 'description' | 'circleMask' | 'rimPattern'>>) => void;
  onSetUvMode: (uv: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLoadDocument: (doc: MintDocument) => void;
  onExportPng: () => string | null;
  onExportBatchPng: (serialOverride?: { layerId: string; number: number }) => string | null;
  showGrid: boolean;
  onToggleGrid: () => void;
  animatePreview: boolean;
  onToggleAnimate: () => void;
  getThumbnailSrc: (id: string) => string | null;
  selectedImage?: { url: string; name: string; mediaType: string } | null;
  onAddImageFromUrl: (src: string, name: string) => void;
};

const LAYER_TYPES: { type: MintLayerConfig['type']; label: string; group: string }[] = [
  { type: 'guilloche', label: 'Guilloche', group: 'Security' },
  { type: 'rosette', label: 'Rosette', group: 'Security' },
  { type: 'fine-line', label: 'Fine Lines', group: 'Security' },
  { type: 'moire', label: 'Moiré', group: 'Security' },
  { type: 'crosshatch', label: 'Crosshatch', group: 'Security' },
  { type: 'stipple', label: 'Stipple', group: 'Security' },
  { type: 'border', label: 'Border', group: 'Structure' },
  { type: 'microprint', label: 'Microprint', group: 'Structure' },
  { type: 'security-thread', label: 'Security Thread', group: 'Structure' },
  { type: 'serial-number', label: 'Serial Number', group: 'Structure' },
  { type: 'qr-code', label: 'QR Code', group: 'Structure' },
  { type: 'text', label: 'Text', group: 'Content' },
  { type: 'text-arc', label: 'Text Arc', group: 'Content' },
  { type: 'image', label: 'Image', group: 'Content' },
  { type: 'gradient', label: 'Gradient', group: 'Background' },
  { type: 'lathe', label: 'Lathe', group: 'Background' },
  { type: 'watermark-pattern', label: 'Watermark', group: 'Background' },
  { type: 'hologram', label: 'Hologram', group: 'Effects' },
];

const BLEND_MODES: { value: MintBlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft Light' }
];

export default function MintPanel({
  doc, selectedLayer, selectedLayerId, canUndo, canRedo, uvMode,
  onAddLayer, onRemoveLayer, onReorderLayer, onUpdateConfig, onUpdateMeta,
  onUpdateTransform, onDuplicateLayer, onSelectLayer, onSetCanvasSize,
  onSetBackgroundColor, onSetDocMeta, onSetUvMode, onUndo, onRedo,
  onLoadDocument, onExportPng, onExportBatchPng, showGrid, onToggleGrid,
  animatePreview, onToggleAnimate, getThumbnailSrc,
  selectedImage, onAddImageFromUrl
}: Props) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showColorSchemes, setShowColorSchemes] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [savedDocs, setSavedDocs] = useState<{ id: string; name: string; filePath: string; updatedAt: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isStamping, setIsStamping] = useState(false);
  const [batchCount, setBatchCount] = useState(10);
  const [batchStatus, setBatchStatus] = useState('');
  const [stampResult, setStampResult] = useState('');

  // Fund & Mint state
  const [mintMode, setMintMode] = useState<'burn' | 'lock' | 'hash'>('burn');
  const [denomination, setDenomination] = useState(1);
  const [lockUntil, setLockUntil] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const [burnTxid, setBurnTxid] = useState<string | null>(null);
  const [burnError, setBurnError] = useState('');

  const handleBurnAndMint = async () => {
    setIsBurning(true);
    setBurnError('');
    try {
      const hasKey = await window.mint.keystoreHasKey();
      if (!hasKey && mintMode !== 'hash') {
        setBurnError('No private key loaded. Connect wallet or import key first.');
        setIsBurning(false);
        return;
      }

      const modeLabel = mintMode === 'burn' ? 'BURN' : mintMode === 'lock' ? 'LOCK' : 'HASH';
      const stampPath = `$MINT/${modeLabel}/${denomination}BSV`;
      const timestamp = new Date().toISOString();
      const hash = `${mintMode}-${denomination}-${Date.now()}`;

      let txid: string;

      if (mintMode === 'hash') {
        // Hash To Mint — no BSV spent, just inscribe the hash
        const dataUrl = onExportPng();
        if (!dataUrl) throw new Error('Export failed');
        const filePath = await window.mint.exportMintPng({ dataUrl, defaultName: `${denomination}bsv-note` });
        if (!filePath) throw new Error('Save failed');
        const fileHash = await window.mint.hashFile(filePath);
        const result = await window.mint.inscribeStamp({
          path: stampPath,
          hash: fileHash.hash,
          timestamp,
        });
        txid = result.txid;
      } else {
        // Burn or Lock — inscribe with value
        const result = await window.mint.inscribeStamp({
          path: stampPath,
          hash: mintMode === 'lock' ? `lock-until:${lockUntil || 'indefinite'}|${hash}` : hash,
          timestamp,
        });
        txid = result.txid;
      }
      setBurnTxid(txid);

      const serialText = txid.slice(0, 12).toUpperCase();
      const denomText = `${denomination} BSV`;
      const verifyUrl = `https://whatsonchain.com/tx/${txid}`;

      // Update doc name
      onSetDocMeta({ name: `${denomText} Note — SN:${serialText}` });

      // Auto-add QR code layer with TXID for verification
      onAddLayer('qr-code');
      // Auto-add serial number layer
      onAddLayer('serial-number');
      // Auto-add denomination text layer
      onAddLayer('text');
      // Auto-add issuer text layer
      onAddLayer('text');

      // Update the configs after a tick (layers need to be added first)
      setTimeout(() => {
        const layers = doc.layers;
        // Find the newly added layers (they'll be at the end)
        const qrLayer = [...layers].reverse().find(l => l.type === 'qr-code');
        const serialLayer = [...layers].reverse().find(l => l.type === 'serial-number');
        const textLayer = [...layers].reverse().find(l => l.type === 'text' && l.name === 'Text');

        if (qrLayer) {
          onUpdateConfig(qrLayer.id, { text: verifyUrl, size: 0.12, x: 0.88, y: 0.85, color: '#ffffff', backgroundColor: '#000000' });
        }
        if (serialLayer) {
          onUpdateConfig(serialLayer.id, { prefix: 'SN', startNumber: parseInt(txid.slice(0, 8), 16) % 1000000, digits: 6, x: 0.12, y: 0.92, fontSize: 18 });
        }
        // Find both text layers (denomination and issuer)
        const textLayers = [...layers].reverse().filter(l => l.type === 'text' && l.name === 'Text');
        if (textLayers[0]) {
          onUpdateConfig(textLayers[0].id, { text: denomText, fontSize: 72, fontWeight: 900, color: '#ffffff', letterSpacing: 12, x: 0.5, y: 0.15, align: 'center' });
          onUpdateMeta(textLayers[0].id, { name: 'Denomination' });
        }
        if (textLayers[1]) {
          // Get wallet handle for issuer
          window.mint.walletStatus().then((ws) => {
            const issuer = ws.connected && ws.handle ? ws.handle : 'Bitcoin Corporation';
            onUpdateConfig(textLayers[1].id, { text: `Issued by ${issuer}`, fontSize: 14, fontWeight: 500, color: '#ffffff', letterSpacing: 4, x: 0.5, y: 0.97, align: 'center' });
            onUpdateMeta(textLayers[1].id, { name: 'Issuer' });
          }).catch(() => {
            onUpdateConfig(textLayers[1].id, { text: 'Issued by Bitcoin Corporation', fontSize: 14, fontWeight: 500, color: '#ffffff', letterSpacing: 4, x: 0.5, y: 0.97, align: 'center' });
            onUpdateMeta(textLayers[1].id, { name: 'Issuer' });
          });
        }
      }, 100);

    } catch (err) {
      setBurnError(err instanceof Error ? err.message : 'Burn failed');
    }
    setIsBurning(false);
  };

  const handleExportNote = async (side: 'front' | 'back') => {
    if (side === 'front') {
      // Export current design as the front
      const dataUrl = onExportPng();
      if (dataUrl) {
        await window.mint.saveFile(dataUrl, undefined, `${doc.name || 'note'}-front.png`);
      }
    } else {
      // Generate back side with verification info
      const canvas = document.createElement('canvas');
      canvas.width = doc.width;
      canvas.height = doc.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = doc.backgroundColor;
      ctx.fillRect(0, 0, doc.width, doc.height);

      // Subtle pattern
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < doc.width; i += 20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, doc.height); ctx.stroke();
      }
      for (let i = 0; i < doc.height; i += 20) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(doc.width, i); ctx.stroke();
      }

      const cx = doc.width / 2;
      const cy = doc.height / 2;

      // Title
      ctx.font = '900 48px Impact, Arial Black, sans-serif';
      ctx.fillStyle = '#ff0040';
      ctx.textAlign = 'center';
      ctx.fillText('BITCOIN CORPORATION', cx, doc.height * 0.08);

      ctx.font = '300 18px Helvetica Neue, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('CERTIFICATE OF VALUE DESTRUCTION', cx, doc.height * 0.12);

      // Denomination
      ctx.font = `900 ${doc.width * 0.12}px Impact, Arial Black, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${denomination} BSV`, cx, doc.height * 0.3);

      // TXID
      ctx.font = '500 14px IBM Plex Mono, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`TXID: ${burnTxid}`, cx, doc.height * 0.38);

      // Serial
      ctx.font = '700 24px IBM Plex Mono, monospace';
      ctx.fillStyle = '#ff0040';
      ctx.fillText(`SN: ${burnTxid!.slice(0, 12).toUpperCase()}`, cx, doc.height * 0.44);

      // Legal text
      ctx.font = '400 11px Helvetica Neue, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      const legal = [
        'This note certifies the permanent, irrevocable destruction of the',
        `denomination amount (${denomination} BSV) on the Bitcoin SV blockchain.`,
        'The burn transaction is publicly verifiable via the QR code or TXID above.',
        'This certificate was produced by the NPGX Mint — a tool of the Bitcoin Corporation.',
        `Issued: ${new Date().toISOString().split('T')[0]}`,
      ];
      legal.forEach((line, i) => {
        ctx.fillText(line, cx, doc.height * 0.8 + i * 16);
      });

      // Protocol marks
      ctx.font = '700 12px Helvetica Neue, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,0,64,0.4)';
      ctx.fillText('$401 · $402 · $403', cx, doc.height * 0.95);

      // Verify URL
      ctx.font = '500 13px IBM Plex Mono, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`Verify: whatsonchain.com/tx/${burnTxid!.slice(0, 20)}...`, cx, doc.height * 0.97);

      const dataUrl = canvas.toDataURL('image/png');
      await window.mint.saveFile(dataUrl, undefined, `${doc.name || 'note'}-back.png`);
    }
  };

  const refreshSavedDocs = useCallback(async () => {
    const docs = await window.mint.listMintDocuments();
    setSavedDocs(docs);
  }, []);

  useEffect(() => {
    if (showSaveLoad) refreshSavedDocs();
  }, [showSaveLoad, refreshSavedDocs]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await window.mint.saveMintDocument(JSON.stringify(doc));
      await refreshSavedDocs();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async (filePath: string) => {
    try {
      const json = await window.mint.loadMintDocument(filePath);
      const loaded = JSON.parse(json) as MintDocument;
      onLoadDocument(loaded);
      setShowSaveLoad(false);
    } catch (err) {
      console.error('Load failed:', err);
    }
  };

  const handleDeleteDoc = async (filePath: string) => {
    try {
      await window.mint.deleteMintDocument(filePath);
      await refreshSavedDocs();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleExportPng = async () => {
    setIsExporting(true);
    try {
      const dataUrl = onExportPng();
      if (dataUrl) await window.mint.exportMintPng({ dataUrl, defaultName: doc.name || 'mint-design' });
    } catch (err) { console.error('Export PNG failed:', err); }
    finally { setIsExporting(false); }
  };

  const handleExportSvg = async () => {
    setIsExporting(true);
    try {
      const dataUrl = onExportPng();
      if (dataUrl) {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}"><image href="${dataUrl}" width="${doc.width}" height="${doc.height}"/></svg>`;
        await window.mint.exportMintSvg({ svgContent, defaultName: doc.name || 'mint-design' });
      }
    } catch (err) { console.error('Export SVG failed:', err); }
    finally { setIsExporting(false); }
  };

  const applyColorScheme = (scheme: ColorScheme) => {
    onSetBackgroundColor(scheme.background);
    for (const layer of doc.layers) {
      if (layer.type === 'border' || layer.type === 'guilloche' || layer.type === 'rosette') {
        onUpdateConfig(layer.id, { color: scheme.primary });
      } else if (layer.type === 'text' || layer.type === 'text-arc') {
        onUpdateConfig(layer.id, { color: scheme.text });
      } else if (layer.type === 'microprint' || layer.type === 'watermark-pattern') {
        onUpdateConfig(layer.id, { color: scheme.secondary + '33' });
      } else if (layer.type === 'serial-number') {
        onUpdateConfig(layer.id, { color: scheme.text });
      } else if (layer.type === 'security-thread') {
        onUpdateConfig(layer.id, { color: scheme.secondary + '33', textColor: scheme.secondary + '55' });
      }
    }
    setShowColorSchemes(false);
  };

  const handleBatchExport = async () => {
    const serialLayer = doc.layers.find((l) => l.type === 'serial-number');
    if (!serialLayer) { setBatchStatus('Add a Serial Number layer first'); return; }
    setIsExporting(true);
    setBatchStatus('Choosing folder...');
    try {
      const folder = await window.mint.chooseExportFolder();
      if (!folder) { setIsExporting(false); setBatchStatus(''); return; }
      const startNum = (serialLayer.config as { startNumber: number }).startNumber;
      const dataUrls: { name: string; dataUrl: string }[] = [];
      for (let i = 0; i < batchCount; i++) {
        setBatchStatus(`Rendering ${i + 1} of ${batchCount}...`);
        const dataUrl = onExportBatchPng({ layerId: serialLayer.id, number: startNum + i });
        if (dataUrl) {
          const padded = String(startNum + i).padStart(4, '0');
          dataUrls.push({ name: `${doc.name || 'mint'}-${padded}.png`, dataUrl });
        }
      }
      setBatchStatus(`Saving ${dataUrls.length} files...`);
      await window.mint.exportMintBatch({ folder, dataUrls });
      setBatchStatus(`Exported ${dataUrls.length} variants`);
    } catch (err) { console.error('Batch export failed:', err); setBatchStatus('Failed'); }
    finally { setIsExporting(false); }
  };

  // Stamp & Inscribe the current design
  const handleStampDesign = async () => {
    setIsStamping(true);
    setStampResult('');
    try {
      const dataUrl = onExportPng();
      if (!dataUrl) throw new Error('Export failed');
      // Save to temp and hash
      const filePath = await window.mint.exportMintPng({ dataUrl, defaultName: doc.name || 'mint-stamp' });
      if (!filePath) { setIsStamping(false); return; }
      const { hash } = await window.mint.hashFile(filePath);
      const timestamp = new Date().toISOString();
      const stampPath = `$STAMP/${doc.name || 'DESIGN'}`;
      const receipt = {
        id: crypto.randomUUID(), path: stampPath, hash, algorithm: 'sha256' as const,
        sourceFile: filePath.split('/').pop() || 'mint.png', sourceSize: 0,
        timestamp, txid: null, tokenId: null, metadata: {}
      };
      await window.mint.saveStampReceipt(JSON.stringify(receipt));
      // Try to inscribe
      try {
        const hasKey = await window.mint.keystoreHasKey();
        if (hasKey) {
          const { txid } = await window.mint.inscribeStamp({ path: stampPath, hash, timestamp });
          await window.mint.updateStampReceipt(receipt.id, { txid });
          setStampResult(`Inscribed: ${txid.slice(0, 12)}...`);
        } else {
          setStampResult(`Hashed: ${hash.slice(0, 16)}... (no key)`);
        }
      } catch { setStampResult(`Hashed: ${hash.slice(0, 16)}... (local only)`); }
    } catch (err) { setStampResult(`Failed: ${err instanceof Error ? err.message : err}`); }
    finally { setIsStamping(false); }
  };

  // Mint token from current design
  const handleMintToken = async () => {
    setIsStamping(true);
    setStampResult('');
    try {
      const dataUrl = onExportPng();
      if (!dataUrl) throw new Error('Export failed');
      const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
      if (!match) throw new Error('Invalid data URL');
      const filePath = await window.mint.exportMintPng({ dataUrl, defaultName: doc.name || 'mint-token' });
      if (!filePath) { setIsStamping(false); return; }
      const { hash } = await window.mint.hashFile(filePath);
      const { tokenId } = await window.mint.mintStampToken({
        path: `$STAMP/${doc.name || 'TOKEN'}`, hash,
        name: doc.name || 'TOKEN',
        iconDataB64: match[2], iconContentType: match[1]
      });
      setStampResult(`Minted: ${tokenId}`);
    } catch (err) { setStampResult(`Failed: ${err instanceof Error ? err.message : err}`); }
    finally { setIsStamping(false); }
  };

  // Save as custom template
  const handleSaveAsTemplate = async () => {
    const name = doc.name || 'Custom Template';
    // Templates are just saved documents that users can re-load
    const templateDoc = { ...doc, name: `Template: ${name}` };
    await window.mint.saveMintDocument(JSON.stringify(templateDoc));
    setBatchStatus(`Saved as template: ${name}`);
    setTimeout(() => setBatchStatus(''), 2000);
  };

  const transform = selectedLayer?.transform || { x: 0, y: 0, rotation: 0, scale: 1 };

  return (
    <aside className="panel right-panel mint-panel">
      <h2>Currency Designer</h2>

      {/* Document Name */}
      <input
        type="text"
        value={doc.name}
        onChange={(e) => onSetDocMeta({ name: e.target.value })}
        placeholder="Document name..."
        className="mint-doc-name-input"
      />

      {/* Toolbar */}
      <div className="control-row" style={{ gap: 4, flexWrap: 'wrap' }}>
        <button className="ghost" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">Undo</button>
        <button className="ghost" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">Redo</button>
        <button className={`ghost ${showGrid ? 'active-toggle' : ''}`} onClick={onToggleGrid} title="Grid">Grid</button>
        <button className={`ghost ${uvMode ? 'active-toggle' : ''}`} onClick={() => onSetUvMode(!uvMode)} title="UV Light mode">UV</button>
        <button className={`ghost ${animatePreview ? 'active-toggle' : ''}`} onClick={onToggleAnimate} title="Animated preview">Anim</button>
      </div>

      {/* Quick Actions */}
      <div className="mint-actions">
        <button className="mint-action-btn" onClick={() => setShowTemplates(!showTemplates)}>Templates</button>
        <button className="mint-action-btn" onClick={() => setShowColorSchemes(!showColorSchemes)}>Colors</button>
        <button className="mint-action-btn" onClick={() => setShowSaveLoad(!showSaveLoad)}>Save/Load</button>
        <button className="mint-action-btn" onClick={() => setShowBatch(!showBatch)}>Batch</button>
      </div>

      {/* Template Picker */}
      {showTemplates && (
        <div className="section mint-dropdown-section">
          <h3>Templates</h3>
          <div className="mint-template-grid">
            {MINT_TEMPLATES.map((tpl) => (
              <button key={tpl.id} className="mint-template-card" onClick={() => { onLoadDocument(tpl.factory()); setShowTemplates(false); }} title={tpl.description}>
                <span className="mint-template-name">{tpl.name}</span>
                <span className="mint-template-desc">{tpl.description}</span>
              </button>
            ))}
          </div>
          <button className="ghost" onClick={handleSaveAsTemplate} style={{ width: '100%', marginTop: 6, fontSize: 11 }}>Save Current as Template</button>
        </div>
      )}

      {/* Color Schemes */}
      {showColorSchemes && (
        <div className="section mint-dropdown-section">
          <h3>Color Schemes</h3>
          <div className="mint-scheme-grid">
            {COLOR_SCHEMES.map((scheme) => (
              <button key={scheme.name} className="mint-scheme-chip" onClick={() => applyColorScheme(scheme)} title={scheme.name}>
                <span className="mint-scheme-swatch" style={{ background: `linear-gradient(135deg, ${scheme.primary}, ${scheme.secondary})` }} />
                <span>{scheme.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save / Load */}
      {showSaveLoad && (
        <div className="section mint-dropdown-section">
          <h3>Documents</h3>
          <button className="secondary" onClick={handleSave} disabled={isSaving} style={{ width: '100%', marginBottom: 8 }}>
            {isSaving ? 'Saving...' : 'Save Current'}
          </button>
          {savedDocs.length === 0 ? (
            <div className="small">No saved documents.</div>
          ) : (
            <div className="mint-saved-docs">
              {savedDocs.map((d) => (
                <div key={d.id} className="mint-saved-doc">
                  <button className="ghost mint-doc-name" onClick={() => handleLoad(d.filePath)}>{d.name || 'Untitled'}</button>
                  <span className="small">{new Date(d.updatedAt).toLocaleDateString()}</span>
                  <button className="ghost" style={{ fontSize: 10, padding: '2px 6px', color: 'var(--danger)' }} onClick={() => handleDeleteDoc(d.filePath)}>x</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Batch Export */}
      {showBatch && (
        <div className="section mint-dropdown-section">
          <h3>Batch Export</h3>
          <div className="small" style={{ marginBottom: 6 }}>Generate serial number variants as PNG.</div>
          <label className="control-row">
            <span>Count</span>
            <input type="number" value={batchCount} min={1} max={1000} step={1} onChange={(e) => setBatchCount(Number(e.target.value))} style={{ width: 80 }} />
          </label>
          <button className="secondary" onClick={handleBatchExport} disabled={isExporting} style={{ width: '100%' }}>
            {isExporting ? 'Exporting...' : `Export ${batchCount} Variants`}
          </button>
          {batchStatus && <div className="small" style={{ marginTop: 4 }}>{batchStatus}</div>}
        </div>
      )}

      {/* Image Controls — always visible when an image layer exists */}
      {(() => {
        const imgLayer = doc.layers.find(l => l.type === 'image');
        if (!imgLayer) return null;
        const ic = imgLayer.config as { src: string; fit: string; x: number; y: number; scale: number };
        return (
          <div className="section">
            <h3 style={{ color: 'var(--accent)' }}>Image</h3>
            <div className="control-group">
              <label className="control-row">
                <span>Zoom</span>
                <input type="range" min={0.2} max={4} step={0.05} value={ic.scale}
                  onChange={(e) => onUpdateConfig(imgLayer.id, { scale: Number(e.target.value) })} />
                <span className="small" style={{ minWidth: 36, textAlign: 'right' }}>{Math.round(ic.scale * 100)}%</span>
              </label>
              <label className="control-row">
                <span>X</span>
                <input type="range" min={-0.5} max={1.5} step={0.01} value={ic.x}
                  onChange={(e) => onUpdateConfig(imgLayer.id, { x: Number(e.target.value) })} />
                <span className="small" style={{ minWidth: 36, textAlign: 'right' }}>{Math.round(ic.x * 100)}%</span>
              </label>
              <label className="control-row">
                <span>Y</span>
                <input type="range" min={-0.5} max={1.5} step={0.01} value={ic.y}
                  onChange={(e) => onUpdateConfig(imgLayer.id, { y: Number(e.target.value) })} />
                <span className="small" style={{ minWidth: 36, textAlign: 'right' }}>{Math.round(ic.y * 100)}%</span>
              </label>
              <label className="control-row">
                <span>Fit</span>
                <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                  {(['cover', 'contain', 'fill'] as const).map(mode => (
                    <button key={mode} className={ic.fit === mode ? 'active' : 'secondary'}
                      onClick={() => onUpdateConfig(imgLayer.id, { fit: mode })}
                      style={{ flex: 1, padding: '3px 0', fontSize: 10, fontWeight: 600 }}>
                      {mode}
                    </button>
                  ))}
                </div>
              </label>
              <label className="control-row">
                <span>Opacity</span>
                <input type="range" min={0.1} max={1} step={0.05} value={imgLayer.opacity}
                  onChange={(e) => onUpdateMeta(imgLayer.id, { opacity: Number(e.target.value) })} />
                <span className="small" style={{ minWidth: 36, textAlign: 'right' }}>{Math.round(imgLayer.opacity * 100)}%</span>
              </label>
            </div>
          </div>
        );
      })()}

      {/* Fund & Mint — Mode + Denomination + Action */}
      <div className="section">
        <h3 style={{ color: 'var(--accent)' }}>Fund &amp; Mint</h3>

        {/* Mint mode selector */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 8, background: 'var(--panel-2)', borderRadius: 6, padding: 2 }}>
          {([
            { id: 'burn' as const, label: 'Burn', desc: 'Destroy BSV' },
            { id: 'lock' as const, label: 'Lock', desc: 'Timelock BSV' },
            { id: 'hash' as const, label: 'Hash', desc: 'Proof only' },
          ]).map(m => (
            <button key={m.id} onClick={() => setMintMode(m.id)}
              title={m.desc}
              style={{
                flex: 1, padding: '5px 0', border: 'none', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                background: mintMode === m.id ? (m.id === 'burn' ? 'var(--accent)' : m.id === 'lock' ? '#f7931a' : '#00e5ff') : 'transparent',
                color: mintMode === m.id ? '#fff' : 'var(--muted)',
              }}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="small" style={{ marginBottom: 8, lineHeight: 1.5 }}>
          {mintMode === 'burn' && 'Permanently destroy BSV. Highest trust — value is irrevocably gone.'}
          {mintMode === 'lock' && 'Lock BSV to a timelock. Redeemable after expiry — like a bond.'}
          {mintMode === 'hash' && 'Hash the design on-chain. No BSV spent — proof of existence only.'}
        </div>

        {/* Lock date picker */}
        {mintMode === 'lock' && (
          <label className="control-row" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11 }}>Lock Until</span>
            <input type="date" value={lockUntil} onChange={e => setLockUntil(e.target.value)}
              style={{ flex: 1, background: 'var(--panel-2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '4px 8px', color: '#fff', fontSize: 11 }} />
          </label>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, marginBottom: 8 }}>
          {[0.001, 0.01, 0.1, 1, 10, 100].map((amt) => (
            <button
              key={amt}
              className={denomination === amt ? 'active' : 'secondary'}
              onClick={() => {
                setDenomination(amt);
                setBurnTxid(null);
                setBurnError('');
                // Load denomination template, then re-insert current image
                const templateIds: Record<number, string> = { 0.001: 'note-001', 0.01: 'note-01', 0.1: 'note-1', 1: 'note-1bsv', 10: 'note-10bsv', 100: 'note-100bsv' };
                const tid = templateIds[amt];
                if (tid) {
                  const tpl = MINT_TEMPLATES.find(t => t.id === tid);
                  if (tpl) {
                    onLoadDocument(tpl.factory());
                    // Re-add the selected image after template loads
                    setTimeout(() => {
                      const img = selectedImage;
                      if (img && img.mediaType !== 'audio' && img.url) {
                        onAddImageFromUrl(img.url, img.name);
                      }
                    }, 50);
                  }
                }
              }}
              style={{
                padding: '6px 0', fontSize: 11, fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                background: denomination === amt ? 'var(--accent)' : undefined,
                borderColor: denomination === amt ? 'var(--accent)' : undefined,
              }}
            >
              {amt >= 1 ? `${amt} BSV` : `${amt} BSV`}
            </button>
          ))}
        </div>
        {burnTxid ? (
          <div style={{ background: 'rgba(0,255,65,0.08)', border: '1px solid rgba(0,255,65,0.2)', borderRadius: 6, padding: 8, marginBottom: 6 }}>
            <div className="small" style={{ color: '#00ff41', fontWeight: 700, marginBottom: 4 }}>
              {mintMode === 'burn' ? 'BURNED & MINTED' : mintMode === 'lock' ? 'LOCKED & MINTED' : 'HASHED & MINTED'}
            </div>
            <div className="small" style={{ fontFamily: "'IBM Plex Mono', monospace", wordBreak: 'break-all' }}>
              TXID: {burnTxid}
            </div>
            <div className="small" style={{ marginTop: 4 }}>
              {mintMode === 'burn' ? 'Burned' : mintMode === 'lock' ? `Locked${lockUntil ? ` until ${lockUntil}` : ''}` : 'Hashed'}: {denomination} BSV &middot; Serial: {burnTxid.slice(0, 12).toUpperCase()}
            </div>
          </div>
        ) : (
          <button
            onClick={handleBurnAndMint}
            disabled={isBurning}
            style={{
              width: '100%', padding: '8px 0',
              background: isBurning ? 'var(--panel-2)' : mintMode === 'burn' ? 'linear-gradient(135deg, #ff0040, #cc0033)' : mintMode === 'lock' ? 'linear-gradient(135deg, #f7931a, #cc7700)' : 'linear-gradient(135deg, #00e5ff, #0099aa)',
              border: 'none', borderRadius: 6, color: '#fff',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 2, cursor: isBurning ? 'wait' : 'pointer',
            }}
          >
            {isBurning ? 'Minting...' : mintMode === 'burn' ? `Burn ${denomination} BSV & Mint` : mintMode === 'lock' ? `Lock ${denomination} BSV & Mint` : `Hash & Mint`}
          </button>
        )}
        {burnError && <div className="small" style={{ color: 'var(--danger)', marginTop: 4 }}>{burnError}</div>}

        {burnTxid && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button className="secondary" onClick={() => handleExportNote('front')} style={{ flex: 1, fontSize: 10 }}>
              Export Front
            </button>
            <button className="secondary" onClick={() => handleExportNote('back')} style={{ flex: 1, fontSize: 10 }}>
              Export Back
            </button>
          </div>
        )}
      </div>

      {/* Export + Stamp + Mint */}
      <div className="section">
        <h3>Export</h3>
        <div className="control-row" style={{ gap: 4 }}>
          <button className="secondary" onClick={handleExportPng} disabled={isExporting} style={{ flex: 1 }}>PNG</button>
          <button className="secondary" onClick={handleExportSvg} disabled={isExporting} style={{ flex: 1 }}>SVG</button>
        </div>
        <div className="control-row" style={{ gap: 4, marginTop: 4 }}>
          <button className="secondary" onClick={handleStampDesign} disabled={isStamping} style={{ flex: 1 }}>
            {isStamping ? 'Stamping...' : 'Stamp & Inscribe'}
          </button>
          <button onClick={handleMintToken} disabled={isStamping} style={{ flex: 1 }}>
            {isStamping ? 'Minting...' : 'Mint Token'}
          </button>
        </div>
        {stampResult && <div className="small" style={{ marginTop: 4, fontFamily: "'IBM Plex Mono', monospace" }}>{stampResult}</div>}
      </div>

      {/* Canvas */}
      <div className="section">
        <h3>Canvas</h3>
        <div className="control-group">
          <label className="control-row">
            <span>Width</span>
            <input type="number" value={doc.width} min={100} max={4000} step={50} onChange={(e) => onSetCanvasSize(Number(e.target.value), doc.height)} style={{ width: 80 }} />
          </label>
          <label className="control-row">
            <span>Height</span>
            <input type="number" value={doc.height} min={100} max={4000} step={50} onChange={(e) => onSetCanvasSize(doc.width, Number(e.target.value))} style={{ width: 80 }} />
          </label>
          <label className="control-row">
            <span>Background</span>
            <input type="color" value={doc.backgroundColor} onChange={(e) => onSetBackgroundColor(e.target.value)} />
          </label>
          <label className="control-row">
            <span>Circle Mask</span>
            <input type="checkbox" checked={doc.circleMask} onChange={(e) => onSetDocMeta({ circleMask: e.target.checked })} />
          </label>
          {doc.circleMask && (
            <>
              <label className="control-row">
                <span>Rim</span>
                <input type="checkbox" checked={doc.rimPattern?.enabled ?? false} onChange={(e) => onSetDocMeta({ rimPattern: { ...doc.rimPattern, enabled: e.target.checked } })} />
              </label>
              {doc.rimPattern?.enabled && (
                <>
                  <label className="control-row">
                    <span>Teeth</span>
                    <input type="range" min={20} max={300} step={5} value={doc.rimPattern.teeth} onChange={(e) => onSetDocMeta({ rimPattern: { ...doc.rimPattern, teeth: Number(e.target.value) } })} />
                    <span className="small" style={{ minWidth: 30, textAlign: 'right' }}>{doc.rimPattern.teeth}</span>
                  </label>
                  <label className="control-row">
                    <span>Depth</span>
                    <input type="range" min={2} max={20} step={1} value={doc.rimPattern.depth} onChange={(e) => onSetDocMeta({ rimPattern: { ...doc.rimPattern, depth: Number(e.target.value) } })} />
                  </label>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Layer List */}
      <div className="section">
        <h3>Layers ({doc.layers.length})</h3>
        <LayerList
          layers={doc.layers}
          selectedLayerId={selectedLayerId}
          getThumbnailSrc={getThumbnailSrc}
          onSelect={onSelectLayer}
          onReorder={onReorderLayer}
          onToggleVisible={(id) => { const l = doc.layers.find((l) => l.id === id); if (l) onUpdateMeta(id, { visible: !l.visible }); }}
          onToggleLock={(id) => { const l = doc.layers.find((l) => l.id === id); if (l) onUpdateMeta(id, { locked: !l.locked }); }}
          onRemove={onRemoveLayer}
          onDuplicate={onDuplicateLayer}
        />
        <div style={{ position: 'relative' }}>
          <button className="secondary" onClick={() => setShowAddMenu(!showAddMenu)} style={{ width: '100%' }}>+ Add Layer</button>
          {showAddMenu && (
            <div className="layer-add-menu">
              {['Security', 'Structure', 'Content', 'Background', 'Effects'].map((group) => {
                const items = LAYER_TYPES.filter((t) => t.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="layer-add-group-label">{group}</div>
                    {items.map(({ type, label }) => (
                      <button key={type} className="ghost" onClick={() => { onAddLayer(type); setShowAddMenu(false); }}>{label}</button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Layer Inspector */}
      {selectedLayer && (
        <div className="section">
          <h3>Layer: {selectedLayer.name}</h3>
          <div className="control-group">
            <label className="control-row">
              <span>Name</span>
              <input type="text" value={selectedLayer.name} onChange={(e) => onUpdateMeta(selectedLayer.id, { name: e.target.value })} />
            </label>
            <label className="control-row">
              <span>Opacity</span>
              <input type="range" min={0} max={1} step={0.01} value={selectedLayer.opacity} onChange={(e) => onUpdateMeta(selectedLayer.id, { opacity: Number(e.target.value) })} />
              <span className="small" style={{ minWidth: 30, textAlign: 'right' }}>{Math.round(selectedLayer.opacity * 100)}%</span>
            </label>
            <label className="control-row">
              <span>Blend</span>
              <select value={selectedLayer.blendMode} onChange={(e) => onUpdateMeta(selectedLayer.id, { blendMode: e.target.value as MintBlendMode })}>
                {BLEND_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label className="control-row">
              <span>UV Only</span>
              <input type="checkbox" checked={selectedLayer.uvOnly ?? false} onChange={(e) => onUpdateMeta(selectedLayer.id, { uvOnly: e.target.checked })} />
            </label>
          </div>

          {/* Transform */}
          <div className="control-group">
            <div className="small" style={{ fontWeight: 600, marginBottom: 2 }}>Transform</div>
            <label className="control-row">
              <span>X</span>
              <input type="range" min={-500} max={500} step={1} value={transform.x} onChange={(e) => onUpdateTransform(selectedLayer.id, { x: Number(e.target.value) })} />
              <span className="small" style={{ minWidth: 30, textAlign: 'right' }}>{transform.x}</span>
            </label>
            <label className="control-row">
              <span>Y</span>
              <input type="range" min={-500} max={500} step={1} value={transform.y} onChange={(e) => onUpdateTransform(selectedLayer.id, { y: Number(e.target.value) })} />
              <span className="small" style={{ minWidth: 30, textAlign: 'right' }}>{transform.y}</span>
            </label>
            <label className="control-row">
              <span>Rotate</span>
              <input type="range" min={-180} max={180} step={1} value={transform.rotation} onChange={(e) => onUpdateTransform(selectedLayer.id, { rotation: Number(e.target.value) })} />
              <span className="small" style={{ minWidth: 30, textAlign: 'right' }}>{transform.rotation}°</span>
            </label>
            <label className="control-row">
              <span>Scale</span>
              <input type="range" min={0.1} max={3} step={0.05} value={transform.scale} onChange={(e) => onUpdateTransform(selectedLayer.id, { scale: Number(e.target.value) })} />
              <span className="small" style={{ minWidth: 30, textAlign: 'right' }}>{transform.scale.toFixed(2)}</span>
            </label>
          </div>

          {/* Type-specific controls */}
          <div className="control-group">
            <PatternControls layer={selectedLayer} onConfigChange={(patch) => onUpdateConfig(selectedLayer.id, patch)} />
          </div>
        </div>
      )}
    </aside>
  );
}
