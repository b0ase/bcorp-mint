import React, { useState } from 'react';

type DocumentEntry = {
  file: string;
  path: string;
  sha256: string;
  size: number;
};

type Props = {
  walletProvider: 'local' | 'handcash';
  walletConnected: boolean;
  onClose: () => void;
};

export default function DocumentHashPanel({ walletProvider, walletConnected, onClose }: Props) {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [isHashing, setIsHashing] = useState(false);
  const [isInscribing, setIsInscribing] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddFiles = async () => {
    const paths = await window.mint.openImages();
    if (!paths || paths.length === 0) return;

    setIsHashing(true);
    setError(null);
    try {
      const results = await window.mint.hashFilesBatch(paths);
      const entries: DocumentEntry[] = [];
      for (let i = 0; i < paths.length; i++) {
        const name = await window.mint.basename(paths[i]);
        entries.push({
          file: name,
          path: paths[i],
          sha256: results[i].hash,
          size: results[i].size,
        });
      }
      setDocuments((prev) => [...prev, ...entries]);
    } catch (err) {
      setError(`Hash failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setIsHashing(false);
    }
  };

  const handleRemove = (idx: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleInscribe = async () => {
    if (documents.length === 0) return;
    setIsInscribing(true);
    setError(null);
    setTxid(null);
    try {
      const result = await window.mint.inscribeDocumentHash({
        hashes: documents.map((d) => ({ file: d.file, sha256: d.sha256 })),
        provider: walletProvider,
      });
      setTxid(result.txid);
    } catch (err) {
      setError(`Inscription failed: ${err instanceof Error ? err.message : err}`);
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
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Inscribe Document Hashes</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Info */}
          <div className="small" style={{ marginBottom: 16, lineHeight: 1.6 }}>
            Hash documents with SHA-256 and inscribe the hashes on BSV via OP_RETURN.
            The documents themselves stay local — only the hashes go on-chain.
          </div>

          {/* Wallet status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: walletConnected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            marginBottom: 16,
          }}>
            <span className={`wallet-dot ${walletConnected ? 'connected' : ''}`} />
            <span className="small" style={{ color: walletConnected ? '#22c55e' : '#888' }}>
              {walletConnected
                ? `Signing with ${walletProvider === 'handcash' ? 'HandCash' : 'Local Wallet'}`
                : 'No wallet connected — connect to inscribe'}
            </span>
          </div>

          {/* Document list */}
          {documents.length > 0 && (
            <div style={{ marginBottom: 16, maxHeight: 280, overflowY: 'auto' }}>
              {documents.map((doc, idx) => (
                <div
                  key={`${doc.file}-${idx}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--panel-2)', marginBottom: 6,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.file}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>
                      {doc.sha256.slice(0, 20)}...{doc.sha256.slice(-12)}
                    </div>
                    <div className="small" style={{ color: 'var(--muted)' }}>{formatSize(doc.size)}</div>
                  </div>
                  <button
                    className="ghost"
                    style={{ fontSize: 16, padding: '2px 8px' }}
                    onClick={() => handleRemove(idx)}
                    title="Remove"
                  >
                    {'\u2715'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="secondary" onClick={handleAddFiles} disabled={isHashing}>
              {isHashing ? 'Hashing\u2026' : '+ Add Documents'}
            </button>
            <button
              onClick={handleInscribe}
              disabled={documents.length === 0 || isInscribing || !walletConnected}
            >
              {isInscribing
                ? 'Inscribing\u2026'
                : `Inscribe ${documents.length} Hash${documents.length !== 1 ? 'es' : ''} to BSV`}
            </button>
          </div>

          {/* Result */}
          {txid && (
            <div className="stamp-receipt" style={{ marginTop: 16, background: 'rgba(34, 197, 94, 0.08)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#22c55e', marginBottom: 4 }}>
                Inscribed on BSV
              </div>
              <div
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(txid)}
              >
                TxID: {txid}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
