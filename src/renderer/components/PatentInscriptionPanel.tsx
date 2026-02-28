import React, { useState } from 'react';

/**
 * The Bitcoin Corporation — UKIPO Patent Inscriptions
 *
 * Pre-loaded with the three patent filings and their verified SHA-256 hashes.
 * One-click inscription to BSV via HandCash or local wallet.
 * Only hashes + public filing metadata go on-chain — the PDFs stay local.
 */

type PatentEntry = {
  id: string;
  filing: string;
  title: string;
  shortTitle: string;
  sha256: string;
  fileSize: string;
  filedDate: string;
  txid: string | null;
  status: 'pending' | 'inscribing' | 'inscribed' | 'failed';
  error: string | null;
};

const PATENTS: PatentEntry[] = [
  {
    id: 'bittrust',
    filing: 'GB2604176.4',
    title: 'Bit Trust: Blockchain-Native IP Registration System',
    shortTitle: 'Bit Trust',
    sha256: '579bcfca1be464f313268693bfaedc58b8c136afcd726bfa6a77d3a4f25645c0',
    fileSize: '186 KB',
    filedDate: '26 Feb 2026',
    txid: null,
    status: 'pending',
    error: null,
  },
  {
    id: 'clawminer',
    filing: 'GB2604178.0',
    title: 'ClawMiner: Hardware AI Agent with Multi-Chain Audit Inscription',
    shortTitle: 'ClawMiner',
    sha256: '7e158c77093ba0179e5981577cd3223651d383815d4c2737c4e672542e3d4c1b',
    fileSize: '176 KB',
    filedDate: '26 Feb 2026',
    txid: null,
    status: 'pending',
    error: null,
  },
  {
    id: 'http-status',
    filing: 'GB2604419.8',
    title: 'HTTP Status Code Tokenization Suite: $401/$402/$403 Protocol Stack',
    shortTitle: '$401/$402/$403',
    sha256: 'c9d412a9c87b2782004b97b3a5848da50e06ba58177d164055bc8c289d2646ea',
    fileSize: '315 KB',
    filedDate: '28 Feb 2026',
    txid: null,
    status: 'pending',
    error: null,
  },
];

type Props = {
  walletProvider: 'local' | 'handcash';
  walletConnected: boolean;
  onClose: () => void;
};

export default function PatentInscriptionPanel({ walletProvider, walletConnected, onClose }: Props) {
  const [patents, setPatents] = useState<PatentEntry[]>(PATENTS);
  const [inscribing, setInscribing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);

  const allDone = patents.every(p => p.status === 'inscribed');
  const anyDone = patents.some(p => p.status === 'inscribed');

  const handleInscribeAll = async () => {
    if (!walletConnected) return;
    setInscribing(true);

    for (let i = 0; i < patents.length; i++) {
      if (patents[i].status === 'inscribed') continue;

      setCurrentIdx(i);
      setPatents(prev => prev.map((p, idx) =>
        idx === i ? { ...p, status: 'inscribing', error: null } : p
      ));

      try {
        const result = await window.mint.inscribeBitTrust({
          contentHash: patents[i].sha256,
          tier: 2,
          title: patents[i].title,
          filing: patents[i].filing,
          provider: walletProvider,
        });

        setPatents(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'inscribed', txid: result.txid } : p
        ));

        // Brief pause between inscriptions to avoid rate limits
        if (i < patents.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err) {
        setPatents(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'failed', error: err instanceof Error ? err.message : String(err) } : p
        ));
      }
    }

    setCurrentIdx(-1);
    setInscribing(false);
  };

  const handleInscribeOne = async (idx: number) => {
    if (!walletConnected) return;
    setInscribing(true);
    setCurrentIdx(idx);

    setPatents(prev => prev.map((p, i) =>
      i === idx ? { ...p, status: 'inscribing', error: null } : p
    ));

    try {
      const result = await window.mint.inscribeBitTrust({
        contentHash: patents[idx].sha256,
        tier: 2,
        title: patents[idx].title,
        filing: patents[idx].filing,
        provider: walletProvider,
      });

      setPatents(prev => prev.map((p, i) =>
        i === idx ? { ...p, status: 'inscribed', txid: result.txid } : p
      ));
    } catch (err) {
      setPatents(prev => prev.map((p, i) =>
        i === idx ? { ...p, status: 'failed', error: err instanceof Error ? err.message : String(err) } : p
      ));
    }

    setCurrentIdx(-1);
    setInscribing(false);
  };

  const statusColor = (status: PatentEntry['status']) => {
    switch (status) {
      case 'pending': return '#888';
      case 'inscribing': return '#f59e0b';
      case 'inscribed': return '#22c55e';
      case 'failed': return '#ef4444';
    }
  };

  const statusText = (status: PatentEntry['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'inscribing': return 'Inscribing...';
      case 'inscribed': return 'On-Chain';
      case 'failed': return 'Failed';
    }
  };

  return (
    <div className="logo-designer-overlay" onClick={onClose}>
      <div className="logo-designer" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="logo-designer-header">
          <h2>Bit Trust — Patent Inscriptions</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Header info */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>
              The Bitcoin Corporation Ltd — UKIPO Patent Filings
            </div>
            <div className="small" style={{ lineHeight: 1.6 }}>
              Three patent applications filed with the UK Intellectual Property Office.
              Each will be inscribed as a <strong>BITTRUST</strong> registration on BSV —
              only the SHA-256 hash and public filing metadata go on-chain.
              The patent documents stay on your machine.
            </div>
          </div>

          {/* Wallet status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: walletConnected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            marginBottom: 20,
          }}>
            <span className={`wallet-dot ${walletConnected ? 'connected' : ''}`} />
            <span className="small" style={{ color: walletConnected ? '#22c55e' : '#888' }}>
              {walletConnected
                ? `Signing with ${walletProvider === 'handcash' ? 'HandCash' : 'Local Wallet'}`
                : 'Connect your wallet to inscribe'}
            </span>
          </div>

          {/* Patent cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {patents.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: p.status === 'inscribed' ? 'rgba(34, 197, 94, 0.05)' : 'var(--panel-2)',
                  border: `1px solid ${p.status === 'inscribed' ? 'rgba(34, 197, 94, 0.2)' : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.12)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {p.filing}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: statusColor(p.status),
                      }}>
                        {statusText(p.status)}
                        {p.status === 'inscribing' && (
                          <span className="animate-pulse"> ...</span>
                        )}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {p.shortTitle}
                    </div>
                    <div className="small" style={{ color: 'var(--muted)', marginBottom: 6 }}>
                      {p.title}
                    </div>

                    {/* Hash */}
                    <div
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 10,
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 4,
                        display: 'inline-block',
                      }}
                      title="Click to copy SHA-256 hash"
                      onClick={() => navigator.clipboard.writeText(p.sha256)}
                    >
                      SHA-256: {p.sha256.slice(0, 24)}...{p.sha256.slice(-12)}
                    </div>

                    <div className="small" style={{ color: 'var(--muted)', marginTop: 4 }}>
                      {p.fileSize} — Filed {p.filedDate}
                    </div>
                  </div>

                  {/* Per-patent inscribe button */}
                  {p.status === 'pending' && walletConnected && !inscribing && (
                    <button
                      className="secondary"
                      style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                      onClick={() => handleInscribeOne(idx)}
                    >
                      Inscribe
                    </button>
                  )}
                </div>

                {/* TXID */}
                {p.txid && (
                  <div style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'rgba(34, 197, 94, 0.08)',
                  }}>
                    <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginBottom: 2 }}>
                      Inscribed on BSV
                    </div>
                    <div
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 11,
                        color: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                      title="Click to copy TXID"
                      onClick={() => navigator.clipboard.writeText(p.txid!)}
                    >
                      {p.txid}
                    </div>
                  </div>
                )}

                {/* Error */}
                {p.error && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>
                    {p.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* On-chain format preview */}
          <div style={{
            marginBottom: 20,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
              On-chain inscription format (per patent):
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: 'var(--accent)',
              lineHeight: 1.8,
              wordBreak: 'break-all',
            }}>
              BITTRUST | &lt;sha256&gt; | &lt;signer&gt; | &lt;timestamp&gt; | TIER:2 | FILING:&lt;ref&gt;
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!allDone && (
              <button
                onClick={handleInscribeAll}
                disabled={!walletConnected || inscribing || allDone}
                style={{ minWidth: 200 }}
              >
                {inscribing
                  ? `Inscribing ${currentIdx + 1} of ${patents.length}...`
                  : anyDone
                    ? `Inscribe Remaining to BSV`
                    : `Inscribe All 3 Patents to BSV`}
              </button>
            )}
            {allDone && (
              <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e' }}>
                All 3 patents inscribed on-chain
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
