'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint, Shield, LogIn, ExternalLink, Copy, Check,
  ChevronDown, ChevronRight, User, Mail, Github, Globe,
  FileText, Camera, Stamp, Link2, AlertCircle, Plus,
  Upload, Hash, Image as ImageIcon, Video, Loader2, Wallet
} from 'lucide-react';
import { useToast } from '@shared/components/Toast';
import { useAuth } from '@shared/lib/auth-context';
import { useApiClient } from '@shared/lib/api-client';
import { useNavigation } from '@shared/lib/navigation-context';

// --- Types ---

interface Identity {
  id: string;
  user_handle: string;
  token_id: string;
  identity_strength: number;
  metadata: Record<string, any>;
  avatar_url?: string;
  github_handle?: string;
  google_email?: string;
  twitter_handle?: string;
  linkedin_name?: string;
  registered_signature_id?: string;
}

interface Strand {
  id: string;
  strand_type: string;
  strand_subtype?: string;
  strand_txid?: string;
  label?: string;
  signature_id?: string;
  provider_handle?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

interface IpThread {
  id: string;
  title: string;
  documentHash: string;
  documentType: string;
  sequence: number;
  txid: string;
  documentId: string | null;
  createdAt: string;
}

// --- Helpers ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STRENGTH_LEVELS = [
  { min: 0, label: 'Basic', color: 'var(--muted)', bg: 'rgba(90, 88, 80, 0.08)', border: 'rgba(90, 88, 80, 0.2)' },
  { min: 2, label: 'Verified', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.08)', border: 'rgba(96, 165, 250, 0.2)' },
  { min: 3, label: 'Strong', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)' },
  { min: 4, label: 'Sovereign', color: '#c9a84c', bg: 'rgba(201, 168, 76, 0.08)', border: 'rgba(201, 168, 76, 0.2)' },
];

function getStrength(score: number) {
  return [...STRENGTH_LEVELS].reverse().find(l => score >= l.min) || STRENGTH_LEVELS[0];
}

const OAUTH_PROVIDERS = [
  { key: 'github', label: 'GitHub', icon: Github, field: 'github_handle' },
  { key: 'google', label: 'Google', icon: Mail, field: 'google_email' },
  { key: 'twitter', label: 'Twitter / X', icon: Globe, field: 'twitter_handle' },
  { key: 'linkedin', label: 'LinkedIn', icon: Link2, field: 'linkedin_name' },
] as const;

// --- Main Component ---

export default function IdentityPage() {
  const { handle, loading: authLoading, login } = useAuth();
  const api = useApiClient();
  const { toast: addToast } = useToast();

  // Data
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [strands, setStrands] = useState<Strand[]>([]);
  const [ipThreads, setIpThreads] = useState<IpThread[]>([]);
  const [registeredSigSvg, setRegisteredSigSvg] = useState<string | null>(null);

  // UI
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);
  const [selfAttestOpen, setSelfAttestOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Self-attestation form
  const [selfAttestForm, setSelfAttestForm] = useState({
    fullName: '', address: '', city: '', country: '', postcode: '', agreed: false,
  });

  // IP thread form
  const [ipForm, setIpForm] = useState({ title: '', description: '' });
  const [bitTrustMode, setBitTrustMode] = useState<'upload' | 'hash'>('upload');
  const [bitTrustFile, setBitTrustFile] = useState<File | null>(null);
  const [bitTrustHash, setBitTrustHash] = useState('');
  const [bitTrustHashInput, setBitTrustHashInput] = useState('');

  // --- Data Fetching ---
  const fetchData = useCallback(async (userHandle: string) => {
    try {
      const res = await api.get(`/api/bitsign/signatures?handle=${userHandle}`);
      if (!res.ok) throw new Error('Failed to load identity');
      const data = await res.json();
      setIdentity(data.identity || null);
      setStrands(data.strands || []);
    } catch (err) {
      console.error('[identity] fetch error:', err);
    }
  }, [api]);

  const fetchIpThreads = useCallback(async () => {
    try {
      const res = await api.get('/api/bitsign/ip-thread');
      if (!res.ok) return;
      const data = await res.json();
      setIpThreads(data.threads || []);
    } catch { /* silent */ }
  }, [api]);

  const fetchRegisteredSig = useCallback(async () => {
    try {
      const res = await api.get('/api/bitsign/registered-signature');
      if (!res.ok) return;
      const data = await res.json();
      setRegisteredSigSvg(data.svg || null);
    } catch { /* silent */ }
  }, [api]);

  useEffect(() => {
    if (!handle) return;
    fetchData(handle);
    fetchIpThreads();
    fetchRegisteredSig();
  }, [handle, fetchData, fetchIpThreads, fetchRegisteredSig]);

  // --- Actions ---
  const copyTxid = useCallback((txid: string) => {
    navigator.clipboard.writeText(txid);
    setCopiedTxid(txid);
    setTimeout(() => setCopiedTxid(null), 2000);
  }, []);

  const submitSelfAttestation = useCallback(async () => {
    if (!selfAttestForm.fullName || !selfAttestForm.agreed) return;
    setIsProcessing(true);
    try {
      const res = await api.post('/api/bitsign/self-attest', selfAttestForm);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Self-attestation failed');
      }
      addToast('Self-attestation submitted! Identity upgraded.', 'success');
      setSelfAttestOpen(false);
      if (handle) fetchData(handle);
    } catch (err: any) {
      addToast(err.message || 'Self-attestation failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [selfAttestForm, handle, api, fetchData, addToast]);

  const handleBitTrustFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBitTrustFile(file);
    setBitTrustHash('');
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      setBitTrustHash(hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
    } catch {
      addToast('Failed to compute file hash', 'error');
    }
  }, [addToast]);

  const submitIpThread = useCallback(async () => {
    if (!ipForm.title) return;
    setIsProcessing(true);
    try {
      if (bitTrustMode === 'upload') {
        if (!bitTrustFile || !bitTrustHash) {
          addToast('Select a file first', 'error');
          return;
        }

        const reader = new FileReader();
        const base64: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(bitTrustFile);
        });
        const rawBase64 = base64.replace(/^data:[^;]+;base64,/, '');

        const uploadRes = await api.post('/api/bitsign/inscribe', {
          signatureType: 'DOCUMENT',
          payload: rawBase64,
          metadata: { fileName: bitTrustFile.name, mimeType: bitTrustFile.type },
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }
        const { id: documentId } = await uploadRes.json();

        const res = await api.post('/api/bitsign/ip-thread', {
          documentId,
          title: ipForm.title.trim(),
          description: ipForm.description?.trim() || '',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'IP thread registration failed');
        }
        const result = await res.json();
        addToast(`IP registered! Seq #${result.sequence}`, 'success');
      } else {
        if (!bitTrustHashInput.trim()) {
          addToast('Enter a hash', 'error');
          return;
        }
        const res = await api.post('/api/bitsign/ip-thread', {
          documentHash: bitTrustHashInput.trim(),
          title: ipForm.title.trim(),
          description: ipForm.description?.trim() || '',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'IP thread registration failed');
        }
        const result = await res.json();
        addToast(`Hash registered! Seq #${result.sequence}`, 'success');
      }

      setIpForm({ title: '', description: '' });
      setBitTrustFile(null);
      setBitTrustHash('');
      setBitTrustHashInput('');
      fetchIpThreads();
    } catch (err: any) {
      addToast(err.message || 'IP thread registration failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [ipForm, bitTrustMode, bitTrustFile, bitTrustHash, bitTrustHashInput, api, fetchIpThreads, addToast]);

  const handleIdDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const rawBase64 = base64.replace(/^data:[^;]+;base64,/, '');

      const uploadRes = await api.post('/api/bitsign/inscribe', {
        signatureType: 'DOCUMENT',
        payload: rawBase64,
        metadata: { fileName: file.name, mimeType: file.type, idDocumentType: docType },
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { id: signatureId } = await uploadRes.json();

      const strandRes = await api.post('/api/bitsign/id-document', {
        signatureId, documentType: docType,
      });
      if (!strandRes.ok) throw new Error('Strand creation failed');

      addToast(`${docType} uploaded and linked to identity`, 'success');
      if (handle) fetchData(handle);
    } catch (err: any) {
      addToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  }, [handle, api, fetchData, addToast]);

  // --- Loading / Auth gate ---
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!handle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <Fingerprint size={40} style={{ color: 'var(--muted)', marginBottom: 8 }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--accent)', textTransform: 'uppercase', margin: 0 }}>Identity</h2>
        <p className="small" style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          Connect your HandCash wallet to view your identity strands and attestations.
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

  const strength = getStrength(identity?.identity_strength || 0);

  return (
    <div className="main" style={{ gridTemplateColumns: '260px 1fr 320px' }}>
      {/* Left panel — Identity Card */}
      <div className="panel" style={{ overflow: 'auto' }}>
        <h2>Identity</h2>

        {/* Avatar + Handle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(201, 168, 76, 0.04)',
          border: '1px solid rgba(201, 168, 76, 0.08)',
        }}>
          {identity?.avatar_url ? (
            <img src={identity.avatar_url} alt="" style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '1px solid rgba(201, 168, 76, 0.2)',
            }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.15), rgba(201, 168, 76, 0.05))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(201, 168, 76, 0.2)',
              fontSize: 16, fontWeight: 800, color: 'var(--accent)',
            }}>
              {handle.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>${handle}</div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 6px', fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              borderRadius: 10, border: `1px solid ${strength.border}`,
              background: strength.bg, color: strength.color,
            }}>
              <Shield size={9} />
              Lv.{identity?.identity_strength || 1} {strength.label}
            </span>
          </div>
          {identity?.token_id && (
            <a href={`https://whatsonchain.com/tx/${identity.token_id}`} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--muted)', padding: 2 }} title="View identity root on-chain">
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Connected Providers */}
        <h3>Connected Providers</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {OAUTH_PROVIDERS.map(({ key, label, icon: Icon, field }) => {
            const connected = identity ? (identity as any)[field] : null;
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 6, fontSize: 11,
                background: connected ? 'rgba(34, 197, 94, 0.04)' : 'var(--panel-2)',
                border: `1px solid ${connected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.03)'}`,
                color: connected ? '#22c55e' : 'var(--muted)',
              }}>
                <Icon size={12} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {connected || label}
                </span>
                {!connected && (
                  <a href={`/api/auth/${key}`} style={{ fontSize: 9, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                    Link
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Registered Signature */}
        {registeredSigSvg && (
          <>
            <h3>Registered Signature</h3>
            <div style={{
              background: 'white', borderRadius: 6, padding: 8,
              maxHeight: 64, overflow: 'hidden',
            }} dangerouslySetInnerHTML={{ __html: registeredSigSvg }} />
          </>
        )}
      </div>

      {/* Center panel — Strands + Self-Attestation + ID Docs */}
      <div className="panel" style={{ overflow: 'auto' }}>
        {/* Self-Attestation */}
        <div style={{
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(201, 168, 76, 0.08)',
          overflow: 'hidden',
        }}>
          <button className="ghost" onClick={() => setSelfAttestOpen(!selfAttestOpen)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '10px 12px', background: 'var(--panel-2)',
            border: 'none', cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={14} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: 12, fontWeight: 700 }}>Self-Attestation</span>
              {(identity?.identity_strength || 0) >= 2 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#22c55e',
                  background: 'rgba(34, 197, 94, 0.08)', padding: '1px 6px', borderRadius: 10,
                }}>Completed</span>
              )}
            </div>
            {selfAttestOpen ? <ChevronDown size={12} style={{ color: 'var(--muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--muted)' }} />}
          </button>

          {selfAttestOpen && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--panel-3)' }}>
              <div className="small" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                Verify your name and address to upgrade from Lv.1 to Lv.2. Stored on-chain as a self-attestation strand.
              </div>
              <input type="text" placeholder="Full Legal Name" value={selfAttestForm.fullName}
                onChange={e => setSelfAttestForm(f => ({ ...f, fullName: e.target.value }))}
                style={inputStyle} />
              <input type="text" placeholder="Address" value={selfAttestForm.address}
                onChange={e => setSelfAttestForm(f => ({ ...f, address: e.target.value }))}
                style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <input type="text" placeholder="City" value={selfAttestForm.city}
                  onChange={e => setSelfAttestForm(f => ({ ...f, city: e.target.value }))}
                  style={inputStyle} />
                <input type="text" placeholder="Postcode" value={selfAttestForm.postcode}
                  onChange={e => setSelfAttestForm(f => ({ ...f, postcode: e.target.value }))}
                  style={inputStyle} />
              </div>
              <input type="text" placeholder="Country" value={selfAttestForm.country}
                onChange={e => setSelfAttestForm(f => ({ ...f, country: e.target.value }))}
                style={inputStyle} />
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 10, color: 'var(--muted)' }}>
                <input type="checkbox" checked={selfAttestForm.agreed}
                  onChange={e => setSelfAttestForm(f => ({ ...f, agreed: e.target.checked }))}
                  style={{ marginTop: 2 }} />
                I declare this information is true and correct to the best of my knowledge.
              </label>
              <button onClick={submitSelfAttestation} disabled={isProcessing || !selfAttestForm.fullName || !selfAttestForm.agreed}
                style={{
                  width: '100%', padding: '8px 16px', borderRadius: 6,
                  background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
                  border: 'none', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  opacity: isProcessing || !selfAttestForm.fullName || !selfAttestForm.agreed ? 0.4 : 1,
                }}>
                {isProcessing ? 'Submitting...' : 'Submit Self-Attestation'}
              </button>
            </div>
          )}
        </div>

        {/* Identity Documents */}
        <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          Identity Documents
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { type: 'passport', label: 'Passport' },
            { type: 'driving_licence', label: 'Licence' },
            { type: 'utility_bill', label: 'Proof of Address' },
          ].map(doc => {
            const hasDoc = strands.some(s => s.strand_subtype === doc.type);
            return (
              <label key={doc.type} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 6px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${hasDoc ? 'rgba(34, 197, 94, 0.15)' : 'rgba(201, 168, 76, 0.08)'}`,
                background: hasDoc ? 'rgba(34, 197, 94, 0.04)' : 'var(--panel-2)',
              }}>
                <Camera size={14} style={{ color: hasDoc ? '#22c55e' : 'var(--muted)' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: hasDoc ? '#22c55e' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {doc.label}
                </span>
                {hasDoc && <Check size={10} style={{ color: '#22c55e' }} />}
                <input type="file" accept="image/*,.pdf" className="hidden"
                  onChange={e => handleIdDocUpload(e, doc.type)} />
              </label>
            );
          })}
        </div>

        {/* Identity Strands Timeline */}
        <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          Identity Strands ({strands.length})
        </h3>
        {strands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Fingerprint size={24} style={{ margin: '0 auto 6px', color: 'rgba(201, 168, 76, 0.15)' }} />
            <div className="small" style={{ color: 'var(--muted)' }}>
              No strands yet. Connect providers or add attestations.
            </div>
          </div>
        ) : (
          <div style={{
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(201, 168, 76, 0.06)',
            overflow: 'hidden',
          }}>
            {strands.map((strand, i) => (
              <div key={strand.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                borderBottom: i < strands.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: strand.strand_txid ? '#22c55e' : 'var(--muted)',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {strand.label || `${strand.strand_type}${strand.strand_subtype ? ` / ${strand.strand_subtype}` : ''}`}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>
                    {formatDate(strand.created_at)}
                    {strand.provider_handle && ` \u00B7 ${strand.provider_handle}`}
                  </div>
                </div>
                {strand.strand_txid && (
                  <button className="ghost" onClick={() => copyTxid(strand.strand_txid!)} title="Copy TXID"
                    style={{ padding: 2 }}>
                    {copiedTxid === strand.strand_txid
                      ? <Check size={10} style={{ color: '#22c55e' }} />
                      : <Copy size={10} style={{ color: 'var(--muted)' }} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel — Bit Trust IP Vault */}
      <div className="panel" style={{ overflow: 'auto' }}>
        <h2 style={{ color: 'var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={13} />
            IP Vault
          </div>
        </h2>

        {/* Thread list */}
        {ipThreads.length > 0 && (
          <div style={{
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(201, 168, 76, 0.08)',
            overflow: 'hidden',
          }}>
            {ipThreads.map((thread, i) => {
              const TypeIcon = thread.documentType === 'HASH_ONLY' ? Hash
                : ['IMAGE', 'PHOTO'].includes(thread.documentType) ? ImageIcon
                : thread.documentType === 'VIDEO' ? Video
                : FileText;

              return (
                <div key={thread.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  borderBottom: i < ipThreads.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'var(--panel-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <TypeIcon size={12} style={{ color: 'var(--muted)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {thread.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--muted)' }}>
                      <span>#{thread.sequence}</span>
                      <span>{formatDate(thread.createdAt)}</span>
                      {thread.txid && (
                        <button className="ghost" onClick={() => copyTxid(thread.txid)}
                          style={{ padding: 0, fontSize: 9, color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace", display: 'flex', alignItems: 'center', gap: 2, border: 'none', background: 'none', cursor: 'pointer' }}>
                          <Copy size={7} />
                          {copiedTxid === thread.txid ? 'Copied' : `${thread.txid.slice(0, 8)}...`}
                        </button>
                      )}
                    </div>
                  </div>
                  <span style={{
                    padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 600, flexShrink: 0,
                    background: thread.txid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    color: thread.txid ? '#22c55e' : '#f59e0b',
                  }}>
                    {thread.txid ? 'On-chain' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* New thread form */}
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(201, 168, 76, 0.08)',
          background: 'var(--panel-2)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            Register New IP
          </h3>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setBitTrustMode('upload')} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              border: 'none',
              background: bitTrustMode === 'upload' ? 'linear-gradient(135deg, rgba(201, 168, 76, 0.2), rgba(201, 168, 76, 0.08))' : 'var(--panel-3)',
              color: bitTrustMode === 'upload' ? 'var(--accent)' : 'var(--muted)',
            }}>
              <Upload size={10} /> Upload
            </button>
            <button onClick={() => setBitTrustMode('hash')} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
              border: 'none',
              background: bitTrustMode === 'hash' ? 'linear-gradient(135deg, rgba(201, 168, 76, 0.2), rgba(201, 168, 76, 0.08))' : 'var(--panel-3)',
              color: bitTrustMode === 'hash' ? 'var(--accent)' : 'var(--muted)',
            }}>
              <Hash size={10} /> Hash Only
            </button>
          </div>

          {bitTrustMode === 'upload' ? (
            <>
              <input type="file" onChange={handleBitTrustFileSelect}
                style={{ fontSize: 10, color: 'var(--muted)' }} />
              {bitTrustHash && (
                <div style={{
                  padding: '6px 8px', borderRadius: 4,
                  background: 'var(--panel-3)', border: '1px solid rgba(201, 168, 76, 0.06)',
                }}>
                  <span style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SHA-256</span>
                  <div style={{
                    fontSize: 9, color: '#22c55e',
                    fontFamily: "'IBM Plex Mono', monospace",
                    wordBreak: 'break-all', marginTop: 2,
                  }}>{bitTrustHash}</div>
                </div>
              )}
            </>
          ) : (
            <input type="text" placeholder="Paste SHA-256 hash (64 hex chars)"
              value={bitTrustHashInput}
              onChange={e => setBitTrustHashInput(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }} />
          )}

          <input type="text" placeholder="Title (e.g., 'Patent: Novel Algorithm v1')"
            value={ipForm.title}
            onChange={e => setIpForm(f => ({ ...f, title: e.target.value }))}
            style={inputStyle} />
          <input type="text" placeholder="Description (optional)"
            value={ipForm.description}
            onChange={e => setIpForm(f => ({ ...f, description: e.target.value }))}
            style={inputStyle} />
          <button onClick={submitIpThread}
            disabled={isProcessing || !ipForm.title || (bitTrustMode === 'upload' ? !bitTrustHash : !bitTrustHashInput.trim())}
            style={{
              width: '100%', padding: '8px 16px', borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.2), rgba(201, 168, 76, 0.08))',
              border: '1px solid rgba(201, 168, 76, 0.2)',
              color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              opacity: isProcessing || !ipForm.title || (bitTrustMode === 'upload' ? !bitTrustHash : !bitTrustHashInput.trim()) ? 0.4 : 1,
            }}>
            {isProcessing ? (
              <><Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Registering...</>
            ) : (
              <><Shield size={12} /> {bitTrustMode === 'upload' ? 'Register IP' : 'Register Hash'}</>
            )}
          </button>
        </div>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="logo-designer-overlay">
          <div style={{
            background: 'var(--panel)', border: '1px solid rgba(201, 168, 76, 0.15)',
            borderRadius: 12, padding: '16px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Shared input style ---
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 6,
  background: 'var(--bg)', border: '1px solid rgba(201, 168, 76, 0.08)',
  color: 'var(--text)', fontSize: 11,
  outline: 'none',
};
