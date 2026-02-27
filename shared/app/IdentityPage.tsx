'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint, Shield, LogIn, ExternalLink, Copy, Check,
  ChevronDown, ChevronRight, User, Mail, Github, Globe,
  FileText, Camera, Stamp, Link2, AlertCircle, Plus,
  Upload, Hash, Image as ImageIcon, Video, Filter, Loader2
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
  { min: 0, label: 'Basic', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/30' },
  { min: 2, label: 'Verified', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  { min: 3, label: 'Strong', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  { min: 4, label: 'Sovereign', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
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
  const [strandsOpen, setStrandsOpen] = useState(false);
  const [ipOpen, setIpOpen] = useState(false);
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

        // Step 1: Upload document
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

        // Step 2: Register IP thread
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
        // Hash-only mode
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!handle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <Fingerprint size={48} className="text-zinc-700 mb-6" />
        <h1 className="text-2xl font-black tracking-tight mb-2">Identity</h1>
        <p className="text-zinc-500 text-sm text-center mb-8 max-w-xs">
          Connect your HandCash wallet to view your identity strands and attestations.
        </p>
        <button
          onClick={login}
          className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-black text-sm uppercase tracking-widest transition-all rounded-full"
        >
          <LogIn size={16} />
          Connect HandCash
        </button>
      </div>
    );
  }

  const strength = getStrength(identity?.identity_strength || 0);

  return (
    <div className="min-h-screen pb-4">
      {/* Identity Card */}
      <header className="px-4 pt-6 pb-4">
        <div className="border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-4 mb-4">
            {identity?.avatar_url ? (
              <img src={identity.avatar_url} alt="" className="w-14 h-14 rounded-full border border-zinc-700" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-600/20 flex items-center justify-center border border-amber-500/30">
                <span className="text-lg font-black text-amber-400">
                  {handle.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <p className="font-bold text-lg">${handle}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${strength.bg} ${strength.color}`}>
                <Shield size={10} />
                Lv.{identity?.identity_strength || 1} {strength.label}
              </span>
            </div>
            {identity?.token_id && (
              <a
                href={`https://whatsonchain.com/tx/${identity.token_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-zinc-500 hover:text-white transition-colors"
                title="View identity root on-chain"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>

          {/* Connected Providers */}
          <div className="grid grid-cols-2 gap-2">
            {OAUTH_PROVIDERS.map(({ key, label, icon: Icon, field }) => {
              const connected = identity ? (identity as any)[field] : null;
              return (
                <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  connected ? 'bg-green-950/30 border border-green-900/30 text-green-400' : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}>
                  <Icon size={14} />
                  <span className="flex-1 truncate">{connected || label}</span>
                  {!connected && (
                    <a href={`/api/auth/${key}`} className="text-[10px] text-zinc-500 hover:text-white">
                      Link
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Registered Signature */}
      {registeredSigSvg && (
        <div className="px-4 mb-4">
          <div className="border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Stamp size={12} /> Registered Signature
            </h3>
            <div
              className="bg-white rounded-lg p-3 max-h-24 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: registeredSigSvg }}
            />
          </div>
        </div>
      )}

      {/* Self-Attestation */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setSelfAttestOpen(!selfAttestOpen)}
          className="w-full flex items-center justify-between px-4 py-3 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <User size={16} className="text-blue-400" />
            <span className="text-sm font-bold">Self-Attestation</span>
            {(identity?.identity_strength || 0) >= 2 && (
              <span className="text-[10px] text-green-500 bg-green-950/30 px-2 py-0.5 rounded-full">Completed</span>
            )}
          </div>
          {selfAttestOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {selfAttestOpen && (
          <div className="mt-2 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-xs text-zinc-500">
              Verify your name and address to upgrade from Lv.1 &rarr; Lv.2. This is stored on-chain as a self-attestation strand.
            </p>
            <input
              type="text" placeholder="Full Legal Name"
              value={selfAttestForm.fullName}
              onChange={e => setSelfAttestForm(f => ({ ...f, fullName: e.target.value }))}
              className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
            <input
              type="text" placeholder="Address"
              value={selfAttestForm.address}
              onChange={e => setSelfAttestForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text" placeholder="City"
                value={selfAttestForm.city}
                onChange={e => setSelfAttestForm(f => ({ ...f, city: e.target.value }))}
                className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <input
                type="text" placeholder="Postcode"
                value={selfAttestForm.postcode}
                onChange={e => setSelfAttestForm(f => ({ ...f, postcode: e.target.value }))}
                className="px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <input
              type="text" placeholder="Country"
              value={selfAttestForm.country}
              onChange={e => setSelfAttestForm(f => ({ ...f, country: e.target.value }))}
              className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
            <label className="flex items-start gap-2 text-xs text-zinc-500">
              <input
                type="checkbox" checked={selfAttestForm.agreed}
                onChange={e => setSelfAttestForm(f => ({ ...f, agreed: e.target.checked }))}
                className="mt-0.5 accent-amber-500"
              />
              I declare this information is true and correct to the best of my knowledge.
            </label>
            <button
              onClick={submitSelfAttestation}
              disabled={isProcessing || !selfAttestForm.fullName || !selfAttestForm.agreed}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors"
            >
              {isProcessing ? 'Submitting...' : 'Submit Self-Attestation'}
            </button>
          </div>
        )}
      </div>

      {/* ID Documents */}
      <div className="px-4 mb-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
          <FileText size={12} /> Identity Documents
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: 'passport', label: 'Passport' },
            { type: 'driving_licence', label: 'Licence' },
            { type: 'utility_bill', label: 'Proof of Address' },
          ].map(doc => {
            const hasDoc = strands.some(s => s.strand_subtype === doc.type);
            return (
              <label key={doc.type} className={`flex flex-col items-center gap-1.5 p-3 border rounded-xl cursor-pointer transition-colors ${
                hasDoc
                  ? 'border-green-800 bg-green-950/20 text-green-400'
                  : 'border-zinc-800 hover:bg-zinc-900 text-zinc-500'
              }`}>
                <Camera size={16} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{doc.label}</span>
                {hasDoc && <Check size={12} className="text-green-400" />}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => handleIdDocUpload(e, doc.type)}
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Identity Strands Timeline */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setStrandsOpen(!strandsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Fingerprint size={16} className="text-amber-400" />
            <span className="text-sm font-bold">Identity Strands</span>
            <span className="text-[10px] text-zinc-600">({strands.length})</span>
          </div>
          {strandsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {strandsOpen && (
          <div className="mt-2 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
            {strands.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-600">
                No strands yet. Connect providers or add attestations.
              </div>
            ) : (
              strands.map(strand => (
                <div key={strand.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    strand.strand_txid ? 'bg-green-500' : 'bg-zinc-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {strand.label || `${strand.strand_type}${strand.strand_subtype ? ` / ${strand.strand_subtype}` : ''}`}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      {formatDate(strand.created_at)}
                      {strand.provider_handle && ` \u00B7 ${strand.provider_handle}`}
                    </p>
                  </div>
                  {strand.strand_txid && (
                    <button
                      onClick={() => copyTxid(strand.strand_txid!)}
                      className="p-1 text-zinc-600 hover:text-white transition-colors"
                      title="Copy TXID"
                    >
                      {copiedTxid === strand.strand_txid ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bit Trust IP Vault */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setIpOpen(!ipOpen)}
          className="w-full flex items-center justify-between px-4 py-3 border border-amber-900/40 rounded-xl hover:bg-zinc-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-amber-400">Bit Trust IP Vault</span>
            <span className="text-[10px] text-zinc-600">({ipThreads.length})</span>
          </div>
          {ipOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {ipOpen && (
          <div className="mt-2 space-y-2">
            {/* Thread list */}
            {ipThreads.length > 0 && (
              <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
                {ipThreads.map(thread => {
                  const typeIcon = thread.documentType === 'HASH_ONLY' ? Hash
                    : ['IMAGE', 'PHOTO'].includes(thread.documentType) ? ImageIcon
                    : thread.documentType === 'VIDEO' ? Video
                    : FileText;
                  const TypeIcon = typeIcon;
                  const badgeColor = thread.documentType === 'HASH_ONLY' ? 'bg-green-950/30 text-green-400'
                    : ['IMAGE', 'PHOTO'].includes(thread.documentType) ? 'bg-purple-950/30 text-purple-400'
                    : thread.documentType === 'VIDEO' ? 'bg-pink-950/30 text-pink-400'
                    : 'bg-blue-950/30 text-blue-400';
                  const badgeLabel = thread.documentType === 'HASH_ONLY' ? 'Hash'
                    : thread.documentType === 'SEALED_DOCUMENT' ? 'Sealed'
                    : thread.documentType === 'PDF' ? 'PDF'
                    : ['IMAGE', 'PHOTO'].includes(thread.documentType) ? 'Image'
                    : thread.documentType === 'VIDEO' ? 'Video'
                    : 'Doc';

                  return (
                    <div key={thread.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
                        <TypeIcon size={14} className="text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-medium truncate">{thread.title}</p>
                          <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-600">#{thread.sequence}</span>
                          <span className="text-[10px] text-zinc-600">{formatDate(thread.createdAt)}</span>
                          {thread.txid && (
                            <>
                              <button
                                onClick={() => copyTxid(thread.txid)}
                                className="text-[10px] text-amber-600 hover:text-amber-400 font-mono flex items-center gap-0.5"
                              >
                                <Copy size={8} />
                                {copiedTxid === thread.txid ? 'Copied' : `${thread.txid.slice(0, 8)}...`}
                              </button>
                              <a
                                href={`https://whatsonchain.com/tx/${thread.txid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-zinc-600 hover:text-white"
                              >
                                <ExternalLink size={10} />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] rounded flex-shrink-0 ${
                        thread.txid ? 'bg-green-950/30 text-green-400' : 'bg-yellow-950/30 text-yellow-400'
                      }`}>
                        {thread.txid ? 'On-chain' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* New thread form */}
            <div className="border border-zinc-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-zinc-500">Register New IP Thread</h4>

              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setBitTrustMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    bitTrustMode === 'upload'
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  <Upload size={12} />
                  Upload
                </button>
                <button
                  onClick={() => setBitTrustMode('hash')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    bitTrustMode === 'hash'
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  <Hash size={12} />
                  Hash Only
                </button>
              </div>

              {bitTrustMode === 'upload' ? (
                <>
                  <input
                    type="file"
                    onChange={handleBitTrustFileSelect}
                    className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-800 file:text-white cursor-pointer"
                  />
                  {bitTrustHash && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">SHA-256</span>
                      <p className="text-[10px] text-green-400 font-mono break-all mt-0.5">{bitTrustHash}</p>
                    </div>
                  )}
                </>
              ) : (
                <input
                  type="text"
                  placeholder="Paste SHA-256 hash (64 hex chars)"
                  value={bitTrustHashInput}
                  onChange={e => setBitTrustHashInput(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-amber-600"
                />
              )}

              <input
                type="text"
                placeholder="Title (e.g., 'Patent: Novel Algorithm v1')"
                value={ipForm.title}
                onChange={e => setIpForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-600"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={ipForm.description}
                onChange={e => setIpForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <button
                onClick={submitIpThread}
                disabled={isProcessing || !ipForm.title || (bitTrustMode === 'upload' ? !bitTrustHash : !bitTrustHashInput.trim())}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Shield size={14} />
                    {bitTrustMode === 'upload' ? 'Register IP' : 'Register Hash'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
