import React, { useCallback, useEffect, useState } from 'react';

type StoredSession = {
  veriffSessionId: string;
  sessionUrl: string;
  subjectAddress: string;
  status: string;
};

type StoredCert = {
  certificate: {
    type: 'BRC-KYC-Certificate';
    version: string;
    issuer: string;
    issuerPublicKey: string;
    subject: string;
    kycProvider: string;
    kycLevel: string;
    status: string;
    verifiedAt: string;
    issuedAt: string;
  };
  signature: string;
  publicKey: string;
  savedAt: string;
};

function shorten(s: string, head = 10, tail = 10): string {
  if (!s) return '';
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function KycPanel({
  defaultSubject,
  onCertChange,
}: {
  defaultSubject?: string | null;
  onCertChange?: () => void;
}) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [cert, setCert] = useState<StoredCert | null>(null);
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'idle' | 'starting' | 'polling'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([
      window.mint.kycSession(),
      window.mint.kycCertificate(),
    ]);
    setSession(s);
    setCert(c);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (defaultSubject && !subject) setSubject(defaultSubject);
  }, [defaultSubject, subject]);

  async function handleStart() {
    setError(null);
    if (!subject.trim()) {
      setError('Subject address or identity key is required');
      return;
    }
    try {
      setBusy('starting');
      const s = await window.mint.kycStart({ subjectAddress: subject.trim(), email: email.trim() || undefined });
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  async function handlePoll() {
    if (!session) return;
    setError(null);
    try {
      setBusy('polling');
      const res = await window.mint.kycPoll(session.veriffSessionId);
      if (res.status === 'approved') {
        await refresh();
        onCertChange?.();
      } else {
        setError(`Decision: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  async function handleReset() {
    await window.mint.kycReset();
    setSession(null);
    setCert(null);
    setError(null);
    setVerifyResult(null);
    onCertChange?.();
  }

  async function handleSelfVerify() {
    if (!cert) return;
    setVerifyResult(null);
    const res = await window.mint.kycVerifyCert({
      certificate: JSON.stringify(cert.certificate),
      signature: cert.signature,
    });
    setVerifyResult(res.valid ? '✓ signature verified by issuer public key' : `✗ invalid: ${res.error ?? 'unknown'}`);
  }

  return (
    <div className="btms-form">
      <h3>Identity verification (Veriff)</h3>
      <p className="btms-dim">
        Required to issue <b>stocks</b> and <b>bonds</b>. Optional for tokens and currency.
        Verification happens in your browser with Veriff. The Mint only stores the resulting
        BSM-signed BRC-KYC-Certificate — no personal data touches this machine.
      </p>

      {cert ? (
        <div className="btms-cert-block">
          <div className="btms-cert-head">
            <span className="btms-pill btms-pill-ok">verified</span>
            <span>{cert.certificate.kycProvider}</span>
            <span className="btms-dim">· {cert.certificate.kycLevel}</span>
          </div>
          <dl className="btms-kv">
            <dt>Subject</dt><dd className="btms-mono">{shorten(cert.certificate.subject)}</dd>
            <dt>Issuer</dt><dd>{cert.certificate.issuer}</dd>
            <dt>Issuer public key</dt><dd className="btms-mono">{shorten(cert.certificate.issuerPublicKey, 12, 12)}</dd>
            <dt>Verified at</dt><dd>{cert.certificate.verifiedAt}</dd>
            <dt>Signature (DER)</dt><dd className="btms-mono">{shorten(cert.signature, 12, 12)}</dd>
          </dl>
          <div className="btms-btn-row">
            <button className="btms-link-btn" onClick={handleSelfVerify}>self-verify</button>
            <button className="btms-link-btn btms-danger-link" onClick={handleReset}>reset</button>
          </div>
          {verifyResult && <div className="btms-dim">{verifyResult}</div>}
        </div>
      ) : session ? (
        <div className="btms-cert-block">
          <div className="btms-cert-head">
            <span className="btms-pill btms-pill-warn">{session.status}</span>
            <span className="btms-dim">Veriff session {shorten(session.veriffSessionId, 8, 8)}</span>
          </div>
          <div className="btms-dim" style={{ marginTop: 8 }}>
            Hosted URL opened in your browser. Finish the identity check, then click below to poll for the decision.
          </div>
          <div className="btms-btn-row">
            <button className="btms-primary-btn" onClick={handlePoll} disabled={busy === 'polling'}>
              {busy === 'polling' ? 'polling Veriff…' : 'Check decision'}
            </button>
            <button className="btms-link-btn btms-danger-link" onClick={handleReset}>reset</button>
          </div>
        </div>
      ) : (
        <>
          <label>
            <span>Subject address / identity key</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="your BSV address or identity pubkey hex"
            />
          </label>
          <label>
            <span>Email (optional, for Veriff vendor data)</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button
            type="button"
            className="btms-primary-btn"
            disabled={busy !== 'idle'}
            onClick={handleStart}
          >
            {busy === 'starting' ? 'Creating session…' : 'Start Veriff verification'}
          </button>
        </>
      )}

      {error && <div className="btms-error">{error}</div>}
    </div>
  );
}
