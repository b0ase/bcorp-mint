'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as bridge from '../../../lib/mint-bridge';

type StampReceipt = {
  id: string;
  path: string;
  hash: string;
  algorithm: string;
  sourceFile: string;
  sourceSize: number;
  timestamp: string;
  txid: string | null;
  tokenId: string | null;
  metadata: Record<string, unknown>;
};

export default function StampPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hash, setHash] = useState('');
  const [stampPath, setStampPath] = useState('$MINT/STAMP-01');
  const [isHashing, setIsHashing] = useState(false);
  const [isInscribing, setIsInscribing] = useState(false);
  const [result, setResult] = useState('');
  const [receipts, setReceipts] = useState<StampReceipt[]>([]);
  const [hasMaster, setHasMaster] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Load receipts on mount
  useEffect(() => {
    bridge.listStampReceipts().then((r) => setReceipts(r as StampReceipt[])).catch(console.error);
    bridge.keystoreHasMaster().then(setHasMaster).catch(() => setHasMaster(false));
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setHash('');
    setResult('');
    // Preview for images
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) handleFile(f);
    };
    input.click();
  };

  const handleHash = async () => {
    if (!file) return;
    setIsHashing(true);
    try {
      const { hash: h } = await bridge.hashFile(file);
      setHash(h);
      setResult(`SHA-256: ${h}`);
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsHashing(false);
    }
  };

  const handleStamp = async () => {
    if (!file) return;
    setIsHashing(true);
    try {
      let h = hash;
      if (!h) {
        const r = await bridge.hashFile(file);
        h = r.hash;
        setHash(h);
      }
      const timestamp = new Date().toISOString();
      const receipt: StampReceipt = {
        id: crypto.randomUUID(),
        path: stampPath,
        hash: h,
        algorithm: 'sha256',
        sourceFile: file.name,
        sourceSize: file.size,
        timestamp,
        txid: null,
        tokenId: null,
        metadata: {}
      };
      await bridge.saveStampReceipt(JSON.stringify(receipt));
      setResult(`Stamped: ${h.slice(0, 16)}... (saved locally)`);
      const updated = await bridge.listStampReceipts() as StampReceipt[];
      setReceipts(updated);
    } catch (err) {
      setResult(`Error: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsHashing(false);
    }
  };

  const handleInscribe = async () => {
    if (!file || !hash) return;
    setIsInscribing(true);
    try {
      const timestamp = new Date().toISOString();
      const { txid } = await bridge.inscribeStamp({ path: stampPath, hash, timestamp });
      setResult(`Inscribed! txid: ${txid}`);
      // Update the latest receipt if exists
      const latest = receipts.find((r) => r.hash === hash);
      if (latest) {
        await bridge.updateStampReceipt(latest.id, { txid });
        const updated = await bridge.listStampReceipts() as StampReceipt[];
        setReceipts(updated);
      }
    } catch (err) {
      setResult(`Inscription failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsInscribing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mint-stamp-page">
      <div className="mint-stamp-main">
        {/* Drop zone */}
        <div
          ref={dropRef}
          className="mint-drop-zone"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={!file ? handlePick : undefined}
        >
          {file ? (
            <div className="mint-file-info">
              {preview && (
                <img src={preview} alt="Preview" className="mint-file-preview" />
              )}
              <div className="mint-file-details">
                <span className="mint-file-name">{file.name}</span>
                <span className="mint-file-size">{formatSize(file.size)}</span>
                <span className="mint-file-type">{file.type || 'unknown'}</span>
              </div>
              <button className="ghost" onClick={(e) => { e.stopPropagation(); setFile(null); setHash(''); setPreview(null); setResult(''); }}>
                Clear
              </button>
            </div>
          ) : (
            <div className="mint-drop-prompt">
              <div className="mint-drop-icon">+</div>
              <p>Drop a file here or click to browse</p>
              <p className="small">Images, videos, documents — any file can be stamped</p>
            </div>
          )}
        </div>

        {/* Stamp path */}
        {file && (
          <div className="mint-stamp-controls">
            <label className="mint-stamp-field">
              <span>Stamp Path</span>
              <input
                type="text"
                value={stampPath}
                onChange={(e) => setStampPath(e.target.value)}
                placeholder="$MINT/SERIES/ISSUE"
              />
            </label>

            {/* Hash display */}
            {hash && (
              <div className="mint-hash-display">
                <span className="mint-hash-label">SHA-256</span>
                <code className="mint-hash-value">{hash}</code>
              </div>
            )}

            {/* Actions */}
            <div className="mint-stamp-actions">
              <button
                className="secondary"
                onClick={handleHash}
                disabled={isHashing || !file}
              >
                {isHashing ? 'Hashing...' : 'Hash'}
              </button>
              <button
                className="secondary"
                onClick={handleStamp}
                disabled={isHashing || !file}
              >
                {isHashing ? 'Stamping...' : 'Hash & Save Receipt'}
              </button>
              {hasMaster && hash && (
                <button
                  onClick={handleInscribe}
                  disabled={isInscribing}
                >
                  {isInscribing ? 'Inscribing...' : 'Inscribe to BSV'}
                </button>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className="mint-result">
                <code>{result}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Receipt history */}
      <aside className="mint-stamp-sidebar">
        <h3>Stamp History</h3>
        {receipts.length === 0 ? (
          <p className="small">No stamps yet. Hash a file to create your first stamp.</p>
        ) : (
          <div className="mint-receipt-list">
            {receipts.map((r) => (
              <div key={r.id} className="mint-receipt-item">
                <div className="mint-receipt-path">{r.path}</div>
                <div className="mint-receipt-file small">{r.sourceFile}</div>
                <div className="mint-receipt-hash small">
                  <code>{r.hash.slice(0, 16)}...</code>
                </div>
                <div className="mint-receipt-meta small">
                  {new Date(r.timestamp).toLocaleDateString()}
                  {r.txid && (
                    <span className="mint-receipt-txid"> · {r.txid.slice(0, 8)}...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
