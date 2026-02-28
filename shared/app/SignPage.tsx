'use client';

import { useEffect, useState } from 'react';
import {
  FileText, Plus, Clock, Check, AlertCircle,
  ExternalLink, Edit3, Copy, ChevronDown, ChevronUp,
  Send, Shield, Mail, Wallet
} from 'lucide-react';
import SendEmailModal from '@shared/components/SendEmailModal';
import { useAuth } from '@shared/lib/auth-context';
import { useApiClient } from '@shared/lib/api-client';

interface Signer {
  name: string;
  role: string;
  order: number;
  status: string;
  signed_at: string | null;
  signing_token?: string;
  email?: string | null;
  email_sent_at?: string | null;
  email_sent_to?: string | null;
}

interface Envelope {
  id: string;
  title: string;
  document_type: string;
  status: string;
  document_hash: string;
  signers: Signer[];
  inscription_txid: string | null;
  created_at: string;
  expires_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', color: 'var(--muted)', bg: 'var(--panel-3)', icon: Edit3 },
  pending: { label: 'Pending', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', icon: Clock },
  partially_signed: { label: 'Partial', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.08)', icon: Edit3 },
  completed: { label: 'Complete', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', icon: Check },
  expired: { label: 'Expired', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', icon: AlertCircle },
};

export default function SignPage() {
  const { handle, loading: authLoading, login } = useAuth();
  const api = useApiClient();
  const [created, setCreated] = useState<Envelope[]>([]);
  const [toSign, setToSign] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [sendModal, setSendModal] = useState<{
    envelopeId: string;
    signer: Signer;
  } | null>(null);

  useEffect(() => {
    if (handle) {
      fetchEnvelopes();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [handle, authLoading]);

  const fetchEnvelopes = async () => {
    try {
      const res = await api.get('/api/envelopes');
      const data = await res.json();
      setCreated(data.created || []);
      setToSign(data.to_sign || []);
    } catch (error) {
      console.error('Failed to fetch envelopes:', error);
    } finally {
      setLoading(false);
    }
  };

  const copySigningUrl = (token: string) => {
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getNextSigner = (signers: Signer[]): Signer | null => {
    const sorted = [...signers].sort((a, b) => a.order - b.order);
    return sorted.find(s => s.status !== 'signed') || null;
  };

  const getMySigner = (signers: Signer[]): Signer | null => {
    return signers.find(s =>
      s.role === 'Director' || s.role === 'Transferor'
    ) || null;
  };

  if (loading || authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!handle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <FileText size={40} style={{ color: 'var(--muted)', marginBottom: 8 }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase', margin: 0 }}>Sign</h2>
        <p className="small" style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          Connect your HandCash wallet to manage documents and signing envelopes.
        </p>
        <button onClick={login} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8,
          background: 'linear-gradient(135deg, #c9a84c, #e6c665)',
          border: 'none', color: '#000', fontSize: 12, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.12em', cursor: 'pointer',
        }}>
          <Wallet size={14} />
          Connect HandCash
        </button>
      </div>
    );
  }

  // If showing new document wizard, render it inline
  if (showNewDoc) {
    const NewDocumentPage = require('./NewDocumentPage').default;
    return <NewDocumentPage onBack={() => { setShowNewDoc(false); fetchEnvelopes(); }} />;
  }

  const handleEmailSent = () => {
    fetchEnvelopes();
    setSendModal(null);
  };

  return (
    <div className="main" style={{ gridTemplateColumns: '260px 1fr 320px' }}>
      {/* Left panel — Actions + Stats */}
      <div className="panel">
        <h2>Documents</h2>

        <button onClick={() => setShowNewDoc(true)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '10px 16px', borderRadius: 8,
          background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.15), rgba(201, 168, 76, 0.05))',
          border: '1px solid rgba(201, 168, 76, 0.2)',
          color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          letterSpacing: '0.06em',
        }}>
          <Plus size={14} />
          New Document
        </button>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--panel-2)',
          }}>
            <span className="small" style={{ color: 'var(--muted)' }}>Created</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{created.length}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--panel-2)',
          }}>
            <span className="small" style={{ color: 'var(--muted)' }}>Needs Signature</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: toSign.length > 0 ? '#f59e0b' : 'var(--muted)' }}>{toSign.length}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--panel-2)',
          }}>
            <span className="small" style={{ color: 'var(--muted)' }}>Completed</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
              {created.filter(e => e.status === 'completed').length}
            </span>
          </div>
        </div>

        {/* Info */}
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(201, 168, 76, 0.04)',
          border: '1px solid rgba(201, 168, 76, 0.08)',
          marginTop: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Shield size={12} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              On-chain Signing
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            All completed documents are hashed and inscribed on BSV for tamper-proof verification.
          </div>
        </div>
      </div>

      {/* Center panel — Envelope List */}
      <div className="panel" style={{ overflow: 'auto' }}>
        {/* "Needs Your Signature" section */}
        {toSign.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Needs Your Signature
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {toSign.map(envelope => (
                <EnvelopeRow
                  key={envelope.id}
                  envelope={envelope}
                  expanded={expandedId === envelope.id}
                  onToggle={() => setExpandedId(expandedId === envelope.id ? null : envelope.id)}
                  copiedToken={copiedToken}
                  onCopyUrl={copySigningUrl}
                  onSendEmail={(signer) => setSendModal({ envelopeId: envelope.id, signer })}
                  getMySigner={getMySigner}
                  getNextSigner={getNextSigner}
                />
              ))}
            </div>
          </>
        )}

        {/* "Your Documents" section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Your Documents ({created.length})
          </span>
        </div>

        {created.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <FileText size={28} style={{ margin: '0 auto 8px', color: 'rgba(201, 168, 76, 0.15)' }} />
            <div className="small" style={{ color: 'var(--muted)', marginBottom: 2 }}>No documents yet</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Create your first signing envelope.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {created.map(envelope => (
              <EnvelopeRow
                key={envelope.id}
                envelope={envelope}
                expanded={expandedId === envelope.id}
                onToggle={() => setExpandedId(expandedId === envelope.id ? null : envelope.id)}
                copiedToken={copiedToken}
                onCopyUrl={copySigningUrl}
                onSendEmail={(signer) => setSendModal({ envelopeId: envelope.id, signer })}
                getMySigner={getMySigner}
                getNextSigner={getNextSigner}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right panel — Selected envelope details */}
      <div className="panel">
        <h2>Details</h2>

        {expandedId && [...created, ...toSign].find(e => e.id === expandedId) ? (() => {
          const env = [...created, ...toSign].find(e => e.id === expandedId)!;
          const config = STATUS_CONFIG[env.status] || STATUS_CONFIG.pending;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{env.title}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
                padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                background: config.bg, color: config.color,
              }}>
                <config.icon size={10} />
                {config.label}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="small" style={{ color: 'var(--muted)' }}>Type</span>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>{env.document_type.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="small" style={{ color: 'var(--muted)' }}>Signers</span>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>
                    {env.signers.filter(s => s.status === 'signed').length}/{env.signers.length} signed
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="small" style={{ color: 'var(--muted)' }}>Created</span>
                  <span style={{ fontSize: 11, color: 'var(--text)' }}>
                    {new Date(env.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Document hash */}
              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--panel-2)',
              }}>
                <div className="small" style={{ color: 'var(--muted)', marginBottom: 3 }}>Document Hash</div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                  color: 'var(--accent)', wordBreak: 'break-all', lineHeight: 1.5,
                }}>
                  {env.document_hash}
                </div>
              </div>

              {/* TXID */}
              {env.inscription_txid && !env.inscription_txid.startsWith('pending-') && (
                <div style={{
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(34, 197, 94, 0.04)',
                  border: '1px solid rgba(34, 197, 94, 0.12)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Check size={10} style={{ color: '#22c55e' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>Inscribed on BSV</span>
                  </div>
                  <a
                    href={`https://whatsonchain.com/tx/${env.inscription_txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                      color: 'var(--accent)', wordBreak: 'break-all', lineHeight: 1.5,
                      textDecoration: 'none',
                    }}
                  >
                    {env.inscription_txid}
                    <ExternalLink size={9} style={{ flexShrink: 0 }} />
                  </a>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                <a
                  href={`/verify/${env.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    border: '1px solid rgba(201, 168, 76, 0.15)',
                    color: 'var(--muted)', textDecoration: 'none',
                  }}
                >
                  <Shield size={10} /> Verify
                </a>
                {env.status === 'completed' && (
                  <a
                    href={`/api/envelopes/${env.id}/pdf`}
                    target="_blank"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      border: '1px solid rgba(201, 168, 76, 0.15)',
                      color: 'var(--muted)', textDecoration: 'none',
                    }}
                  >
                    <FileText size={10} /> PDF
                  </a>
                )}
              </div>
            </div>
          );
        })() : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <FileText size={28} style={{ margin: '0 auto 8px', color: 'rgba(201, 168, 76, 0.15)' }} />
            <div className="small" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Select a document to view its details and signing progress.
            </div>
          </div>
        )}

        {/* On-chain format */}
        <div style={{ marginTop: 'auto' }}>
          <div className="small" style={{ fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
            On-chain format
          </div>
          <code style={{
            display: 'block', fontSize: 9, color: 'var(--accent)', opacity: 0.5,
            fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.6, wordBreak: 'break-all',
          }}>
            BITSIGN | &lt;doc_hash&gt; | &lt;signers&gt; | &lt;timestamp&gt;
          </code>
        </div>
      </div>

      {/* Send Email Modal */}
      {sendModal && (
        <SendEmailModal
          isOpen={true}
          onClose={() => setSendModal(null)}
          onSent={handleEmailSent}
          envelopeId={sendModal.envelopeId}
          signerName={sendModal.signer.name}
          signerRole={sendModal.signer.role}
          signerEmail={sendModal.signer.email}
          signingToken={sendModal.signer.signing_token!}
        />
      )}
    </div>
  );
}

// --- Envelope Row Sub-component ---

function EnvelopeRow({
  envelope,
  expanded,
  onToggle,
  copiedToken,
  onCopyUrl,
  onSendEmail,
  getMySigner,
  getNextSigner,
}: {
  envelope: Envelope;
  expanded: boolean;
  onToggle: () => void;
  copiedToken: string | null;
  onCopyUrl: (token: string) => void;
  onSendEmail: (signer: Signer) => void;
  getMySigner: (signers: Signer[]) => Signer | null;
  getNextSigner: (signers: Signer[]) => Signer | null;
}) {
  const config = STATUS_CONFIG[envelope.status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const signedCount = envelope.signers.filter(s => s.status === 'signed').length;
  const mySigner = getMySigner(envelope.signers);
  const nextSigner = getNextSigner(envelope.signers);
  const iNeedToSign = mySigner && mySigner.status !== 'signed' && nextSigner?.order === mySigner.order;

  return (
    <div style={{
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${expanded ? 'rgba(201, 168, 76, 0.12)' : 'rgba(255, 255, 255, 0.04)'}`,
      background: expanded ? 'var(--panel-2)' : 'rgba(255, 255, 255, 0.01)',
      overflow: 'hidden',
    }}>
      {/* Main Row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', cursor: 'pointer', transition: 'background 0.15s',
        }}
      >
        <FileText size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {envelope.title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {envelope.document_type.replace(/_/g, ' ')}
          </div>
        </div>

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
          background: config.bg, color: config.color,
        }}>
          <StatusIcon size={9} />
          {config.label}
        </span>

        <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {signedCount}/{envelope.signers.length}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
          {iNeedToSign && mySigner?.signing_token && (
            <a href={`/sign/${mySigner.signing_token}`} style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: 'linear-gradient(135deg, #c9a84c, #e6c665)',
              color: '#000', textDecoration: 'none',
            }}>
              Sign
            </a>
          )}
          {envelope.inscription_txid && !envelope.inscription_txid.startsWith('pending-') && (
            <a
              href={`https://whatsonchain.com/tx/${envelope.inscription_txid}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: 6,
                border: '1px solid rgba(201, 168, 76, 0.15)',
                color: 'var(--muted)',
              }}
              title="View on blockchain"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        {expanded ? <ChevronUp size={12} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--muted)' }} />}
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(201, 168, 76, 0.06)',
          padding: 14, background: 'var(--panel-3)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            Signers
          </h3>
          {envelope.signers
            .sort((a, b) => a.order - b.order)
            .map((signer, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: i < envelope.signers.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {signer.status === 'signed' ? (
                  <Check size={12} style={{ color: '#22c55e' }} />
                ) : (
                  <Clock size={12} style={{ color: 'var(--muted)' }} />
                )}
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{signer.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>{signer.role}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {signer.status === 'signed' ? (
                  <span style={{ fontSize: 10, color: '#22c55e' }}>
                    Signed {signer.signed_at ? new Date(signer.signed_at).toLocaleDateString() : ''}
                  </span>
                ) : signer.signing_token ? (
                  <>
                    <button className="ghost" onClick={(e) => { e.stopPropagation(); onSendEmail(signer); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                        borderRadius: 4, fontSize: 10, fontWeight: 600,
                        border: `1px solid ${signer.email_sent_at ? 'rgba(34, 197, 94, 0.2)' : 'rgba(201, 168, 76, 0.12)'}`,
                        color: signer.email_sent_at ? '#22c55e' : 'var(--muted)',
                      }}>
                      {signer.email_sent_at ? <><Check size={9} /> Sent</> : <><Mail size={9} /> Send</>}
                    </button>
                    <button className="ghost" onClick={(e) => { e.stopPropagation(); onCopyUrl(signer.signing_token!); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                        borderRadius: 4, fontSize: 10, fontWeight: 600,
                        border: `1px solid ${copiedToken === signer.signing_token ? 'rgba(34, 197, 94, 0.2)' : 'rgba(201, 168, 76, 0.12)'}`,
                        color: copiedToken === signer.signing_token ? '#22c55e' : 'var(--muted)',
                      }}>
                      {copiedToken === signer.signing_token ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Link</>}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Pending</span>
                )}
              </div>
            </div>
          ))}

          {/* Hash at bottom */}
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
            color: 'var(--accent)', opacity: 0.4, wordBreak: 'break-all',
          }}>
            {envelope.document_hash.slice(0, 24)}...
          </div>
        </div>
      )}
    </div>
  );
}
