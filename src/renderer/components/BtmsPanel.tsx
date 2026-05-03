import React, { useCallback, useEffect, useState } from 'react';
import KycPanel from './KycPanel';

type BtmsAsset = {
  assetId: string;
  name?: string;
  balance: number;
  metadata?: Record<string, unknown>;
  hasPendingIncoming?: boolean;
};

type AssetClass = 'stock' | 'bond' | 'token' | 'currency';

type Tab = 'home' | 'issue' | 'send' | 'receive' | 'burn' | 'kyc';

const TAB_LABEL: Record<Tab, string> = {
  home: 'Vault',
  issue: 'Issue',
  send: 'Send',
  receive: 'Receive',
  burn: 'Burn',
  kyc: 'KYC',
};

const TAB_ORDER: Tab[] = ['home', 'issue', 'send', 'receive', 'burn', 'kyc'];

const ASSET_CLASSES: { value: AssetClass; label: string; gated: boolean }[] = [
  { value: 'token', label: 'Token', gated: false },
  { value: 'currency', label: 'Currency', gated: false },
  { value: 'stock', label: 'Stock', gated: true },
  { value: 'bond', label: 'Bond', gated: true },
];

function shorten(s: string, head = 8, tail = 6): string {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function BtmsPanel() {
  const [tab, setTab] = useState<Tab>('home');
  const [status, setStatus] = useState<{
    walletReady: boolean;
    networkPreset: string;
    identityKey: string | null;
    reason?: string;
  } | null>(null);
  const [assets, setAssets] = useState<BtmsAsset[]>([]);
  const [incoming, setIncoming] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasCert, setHasCert] = useState(false);

  const refreshStatus = useCallback(async () => {
    const s = await window.mint.btmsStatus();
    setStatus(s);
    return s;
  }, []);

  const refreshAssets = useCallback(async () => {
    try {
      setLoading(true);
      const [a, i, c] = await Promise.all([
        window.mint.btmsListAssets(),
        window.mint.btmsListIncoming(),
        window.mint.kycCertificate(),
      ]);
      setAssets(a);
      setIncoming(i);
      setHasCert(!!c);
    } catch (err) {
      console.error('[btms] refresh failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshAssets();
  }, [refreshStatus, refreshAssets]);

  return (
    <div className="btms-panel">
      <div className="btms-header">
        <h2>BTMS — Basic Token Management</h2>
        <BtmsStatusPill status={status} onRetry={refreshStatus} />
      </div>

      <div className="btms-tabs">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            className={`btms-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
            {t === 'receive' && incoming.length > 0 ? ` (${incoming.length})` : ''}
            {t === 'kyc' && hasCert ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className="btms-body">
        {tab === 'home' && (
          <VaultView assets={assets} loading={loading} onRefresh={refreshAssets} />
        )}
        {tab === 'issue' && (
          <IssueView
            hasCert={hasCert}
            onIssued={refreshAssets}
          />
        )}
        {tab === 'send' && (
          <SendView assets={assets} onSent={refreshAssets} />
        )}
        {tab === 'receive' && (
          <ReceiveView incoming={incoming} onAccepted={refreshAssets} />
        )}
        {tab === 'burn' && (
          <BurnView assets={assets} onBurned={refreshAssets} />
        )}
        {tab === 'kyc' && (
          <KycPanel
            defaultSubject={status?.identityKey ?? null}
            onCertChange={() => { refreshAssets(); }}
          />
        )}
      </div>
    </div>
  );
}

// ---- Subviews --------------------------------------------------------------

function BtmsStatusPill({
  status,
  onRetry,
}: {
  status: { walletReady: boolean; networkPreset: string; identityKey: string | null; reason?: string } | null;
  onRetry: () => void;
}) {
  if (!status) return <span className="btms-pill btms-pill-muted">checking…</span>;
  if (!status.walletReady) {
    return (
      <div className="btms-status-block">
        <span className="btms-pill btms-pill-warn">wallet offline</span>
        <span className="btms-status-reason">{status.reason ?? 'MetaNet Desktop not available'}</span>
        <button className="btms-link-btn" onClick={onRetry}>retry</button>
      </div>
    );
  }
  return (
    <div className="btms-status-block">
      <span className="btms-pill btms-pill-ok">{status.networkPreset}</span>
      <span className="btms-status-id" title={status.identityKey ?? ''}>
        {status.identityKey ? shorten(status.identityKey, 10, 10) : '—'}
      </span>
    </div>
  );
}

function VaultView({
  assets,
  loading,
  onRefresh,
}: {
  assets: BtmsAsset[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="btms-vault">
      <div className="btms-vault-head">
        <span className="btms-dim">{assets.length} assets</span>
        <button className="btms-link-btn" onClick={onRefresh} disabled={loading}>
          {loading ? 'refreshing…' : 'refresh'}
        </button>
      </div>
      {assets.length === 0 && (
        <div className="btms-empty">
          No assets yet. Use the Issue tab to mint your first stock, bond, token, or currency.
        </div>
      )}
      <ul className="btms-asset-list">
        {assets.map((a) => {
          const cls = (a.metadata?.asset_class as string | undefined) ?? 'token';
          return (
            <li key={a.assetId} className="btms-asset-row">
              <div className="btms-asset-top">
                <span className={`btms-class-tag btms-class-${cls}`}>{cls}</span>
                <span className="btms-asset-name">{a.name ?? 'unnamed'}</span>
                <span className="btms-asset-balance">{a.balance}</span>
              </div>
              <div className="btms-asset-id" title={a.assetId}>{shorten(a.assetId, 10, 14)}</div>
              {a.hasPendingIncoming && (
                <div className="btms-asset-flag">pending incoming</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IssueView({
  hasCert,
  onIssued,
}: {
  hasCert: boolean;
  onIssued: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconURL, setIconURL] = useState('');
  const [amount, setAmount] = useState(1000);
  const [assetClass, setAssetClass] = useState<AssetClass>('token');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classInfo = ASSET_CLASSES.find((c) => c.value === assetClass)!;
  const requiresKyc = classInfo.gated;
  const gated = requiresKyc && !hasCert;

  async function handleIssue() {
    setError(null);
    setResult(null);
    if (!name.trim()) {
      setError('Asset name is required');
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setError('Amount must be a positive integer');
      return;
    }
    try {
      setBusy(true);
      const metadata: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        iconURL: iconURL.trim() || undefined,
        asset_class: assetClass,
      };

      if (requiresKyc) {
        const stored = await window.mint.kycCertificate();
        if (!stored) {
          setError('No BRC-KYC-Certificate on this device. Complete KYC first.');
          return;
        }
        metadata.kyc_certificate = JSON.stringify(stored.certificate);
        metadata.kyc_certificate_signature = stored.signature;
      }

      const res = await window.mint.btmsIssue({ amount, metadata });
      if (!res.success) {
        setError(res.error ?? 'Issuance failed');
        return;
      }
      setResult(`Issued ${res.amount} ${name} · asset ${res.assetId}`);
      onIssued();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="btms-form">
      <h3>Issue new asset</h3>
      <label>
        <span>Asset class</span>
        <div className="btms-class-grid">
          {ASSET_CLASSES.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`btms-class-btn ${assetClass === c.value ? 'active' : ''}`}
              onClick={() => setAssetClass(c.value)}
            >
              <span className="btms-class-label">{c.label}</span>
              {c.gated && <span className="btms-class-gated">requires KYC</span>}
            </button>
          ))}
        </div>
      </label>
      <label>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. bCorp Preferred" />
      </label>
      <label>
        <span>Description</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — what this asset represents"
        />
      </label>
      <label>
        <span>Icon URL (UHRP or https)</span>
        <input value={iconURL} onChange={(e) => setIconURL(e.target.value)} placeholder="uhrp://… or https://…" />
      </label>
      <label>
        <span>Amount to issue</span>
        <input
          type="number"
          value={amount}
          min={1}
          step={1}
          onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
        />
      </label>

      {gated && (
        <div className="btms-warn-block">
          <b>{classInfo.label} issuance is gated.</b> Stocks and bonds require a verified BRC-KYC-Certificate attached to the issuance metadata. Switch to the KYC tab to complete verification.
        </div>
      )}

      {error && <div className="btms-error">{error}</div>}
      {result && <div className="btms-success">{result}</div>}

      <button
        type="button"
        className="btms-primary-btn"
        disabled={busy || gated}
        onClick={handleIssue}
      >
        {busy ? 'Issuing…' : `Issue ${assetClass}`}
      </button>
    </div>
  );
}

function SendView({
  assets,
  onSent,
}: {
  assets: BtmsAsset[];
  onSent: () => void;
}) {
  const [assetId, setAssetId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (assets.length > 0 && !assetId) setAssetId(assets[0].assetId);
  }, [assets, assetId]);

  async function handleSend() {
    setError(null);
    setResult(null);
    if (!assetId) { setError('Pick an asset'); return; }
    if (!recipient.trim()) { setError('Recipient identity key required'); return; }
    if (!Number.isInteger(amount) || amount <= 0) { setError('Amount must be positive integer'); return; }
    try {
      setBusy(true);
      const res = await window.mint.btmsSend({ assetId, recipient: recipient.trim(), amount });
      if (!res.success) { setError(res.error ?? 'Send failed'); return; }
      setResult(`Sent ${amount} · tx ${shorten(res.txid, 10, 10)}`);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="btms-form">
      <h3>Send tokens</h3>
      <label>
        <span>Asset</span>
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          {assets.length === 0 && <option value="">(no assets in wallet)</option>}
          {assets.map((a) => (
            <option key={a.assetId} value={a.assetId}>
              {a.name ?? 'unnamed'} · {a.balance} · {shorten(a.assetId, 6, 8)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Recipient identity public key (hex)</span>
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="03abc…" />
      </label>
      <label>
        <span>Amount</span>
        <input
          type="number"
          value={amount}
          min={1}
          step={1}
          onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
        />
      </label>

      {error && <div className="btms-error">{error}</div>}
      {result && <div className="btms-success">{result}</div>}

      <button
        type="button"
        className="btms-primary-btn"
        disabled={busy || assets.length === 0}
        onClick={handleSend}
      >
        {busy ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}

function ReceiveView({
  incoming,
  onAccepted,
}: {
  incoming: Record<string, unknown>[];
  onAccepted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(p: Record<string, unknown>) {
    setError(null);
    const key = `${p.txid}:${p.outputIndex}`;
    try {
      setBusy(key);
      const res = await window.mint.btmsAccept(p);
      if (!res.success) setError(res.error ?? 'Accept failed');
      else onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="btms-form">
      <h3>Incoming transfers</h3>
      {incoming.length === 0 && (
        <div className="btms-empty">No pending incoming tokens.</div>
      )}
      {incoming.map((p) => {
        const key = `${p.txid}:${p.outputIndex}`;
        return (
          <div key={key} className="btms-incoming-row">
            <div className="btms-incoming-top">
              <span className="btms-dim">from</span>
              <span className="btms-mono">{shorten(String(p.sender), 10, 10)}</span>
              <span className="btms-incoming-amount">{String(p.amount)}</span>
            </div>
            <div className="btms-dim">
              asset {shorten(String(p.assetId), 8, 10)} · tx {shorten(String(p.txid), 8, 10)}
            </div>
            <button
              type="button"
              className="btms-primary-btn"
              disabled={busy === key}
              onClick={() => accept(p)}
            >
              {busy === key ? 'Accepting…' : 'Accept'}
            </button>
          </div>
        );
      })}
      {error && <div className="btms-error">{error}</div>}
    </div>
  );
}

function BurnView({
  assets,
  onBurned,
}: {
  assets: BtmsAsset[];
  onBurned: () => void;
}) {
  const [assetId, setAssetId] = useState('');
  const [burnAll, setBurnAll] = useState(true);
  const [amount, setAmount] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (assets.length > 0 && !assetId) setAssetId(assets[0].assetId);
  }, [assets, assetId]);

  async function handleBurn() {
    setError(null);
    setResult(null);
    if (!assetId) { setError('Pick an asset'); return; }
    if (!burnAll && (!Number.isInteger(amount) || amount <= 0)) {
      setError('Amount must be positive integer or select Burn all');
      return;
    }
    try {
      setBusy(true);
      const res = await window.mint.btmsBurn({ assetId, amount: burnAll ? undefined : amount });
      if (!res.success) { setError(res.error ?? 'Burn failed'); return; }
      setResult(`Burned ${res.amountBurned} · tx ${shorten(res.txid, 10, 10)}`);
      onBurned();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="btms-form">
      <h3>Burn tokens</h3>
      <label>
        <span>Asset</span>
        <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
          {assets.length === 0 && <option value="">(no assets)</option>}
          {assets.map((a) => (
            <option key={a.assetId} value={a.assetId}>
              {a.name ?? 'unnamed'} · balance {a.balance}
            </option>
          ))}
        </select>
      </label>
      <label className="btms-checkbox-row">
        <input type="checkbox" checked={burnAll} onChange={(e) => setBurnAll(e.target.checked)} />
        <span>Burn entire balance</span>
      </label>
      {!burnAll && (
        <label>
          <span>Amount to burn</span>
          <input
            type="number"
            value={amount}
            min={1}
            step={1}
            onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
          />
        </label>
      )}

      {error && <div className="btms-error">{error}</div>}
      {result && <div className="btms-success">{result}</div>}

      <button
        type="button"
        className="btms-primary-btn btms-danger-btn"
        disabled={busy || assets.length === 0}
        onClick={handleBurn}
      >
        {busy ? 'Burning…' : 'Burn'}
      </button>
    </div>
  );
}
