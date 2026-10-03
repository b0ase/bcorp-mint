import React, { useState } from 'react';
import type { WalletProviderType, WalletState } from '@shared/lib/types';

type Props = {
  walletState: WalletState;
  onSwitchProvider: (type: WalletProviderType) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenWalletView: () => void;
};

const PROVIDER_ICONS: Record<WalletProviderType, string> = {
  local: '\u{1F511}',
  handcash: '\u{1F91D}',
  yours: 'b',
  metanet: '\u{1F310}',
};

/** Shown while nothing is connected, per provider. */
function connectLabel(walletState: WalletState): string {
  const current = walletState.availableProviders.find((p) => p.type === walletState.provider);
  if (walletState.provider === 'local') return 'Set Up Wallet';
  return `Connect ${current?.label ?? 'Wallet'}`;
}

export default function WalletSelector({ walletState, onSwitchProvider, onConnect, onDisconnect, onOpenWalletView }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // $handle (HandCash / bWallet) as-is; a bare handle gets an @; else the shortened address.
  const displayName = walletState.handle
    ? walletState.handle.startsWith('$') || walletState.handle.includes('…')
      ? walletState.handle
      : `@${walletState.handle}`
    : walletState.masterAddress
      ? `${walletState.masterAddress.slice(0, 6)}...${walletState.masterAddress.slice(-4)}`
      : null;

  const handleStatusClick = () => {
    if (!walletState.connected) {
      // Local keystore: the wallet view creates or imports a key. Any other provider: connect it.
      if (walletState.provider === 'local' && !walletState.masterAddress) onOpenWalletView();
      else onConnect();
      return;
    }
    setDropdownOpen(!dropdownOpen);
  };

  const providerIcon = (type: WalletProviderType) => (
    <span className={`wallet-provider-icon ${type === 'yours' ? 'wallet-provider-icon--b' : ''}`}>{PROVIDER_ICONS[type]}</span>
  );

  return (
    <div className="wallet-selector" style={{ position: 'relative' }}>
      <button
        className="wallet-status"
        onClick={handleStatusClick}
        title={walletState.connected ? 'Wallet options' : connectLabel(walletState)}
      >
        <span className={`wallet-dot ${walletState.connected ? 'connected' : ''}`} />
        {providerIcon(walletState.provider)}
        {walletState.connected ? (
          <span className="wallet-info">
            {displayName}
            {walletState.balance !== null && walletState.balance >= 0 && (
              <span className="wallet-balance"> ({walletState.balance.toLocaleString()} sats)</span>
            )}
            {(walletState.provider === 'metanet' || walletState.provider === 'yours') && (
              <span className="wallet-brc100-badge">BRC-100</span>
            )}
          </span>
        ) : (
          <span className="wallet-info wallet-info-empty">{connectLabel(walletState)}</span>
        )}
      </button>

      {dropdownOpen && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-header">Wallet Provider</div>
          {walletState.availableProviders.map((p) => (
            <button
              key={p.type}
              className={`wallet-dropdown-item ${p.type === walletState.provider ? 'active' : ''}`}
              disabled={!p.available}
              onClick={() => {
                onSwitchProvider(p.type as WalletProviderType);
                setDropdownOpen(false);
              }}
            >
              {providerIcon(p.type as WalletProviderType)}
              <span>{p.label}</span>
              {(p.type === 'metanet' || p.type === 'yours') && <span className="wallet-brc100-tag">BRC-100</span>}
              {!p.available && <span className="wallet-unavailable">Not Available</span>}
              {p.available && p.type === 'metanet' && <span className="wallet-detected">Detected</span>}
              {p.type === walletState.provider && <span className="wallet-active-badge">Active</span>}
            </button>
          ))}
          <div className="wallet-dropdown-divider" />
          <button
            className="wallet-dropdown-item"
            onClick={() => { onOpenWalletView(); setDropdownOpen(false); }}
          >
            <span>&#x2699;</span>
            <span>Manage Local Keys</span>
          </button>
          {walletState.connected ? (
            <button className="wallet-dropdown-item danger" onClick={() => { onDisconnect(); setDropdownOpen(false); }}>
              Disconnect
            </button>
          ) : (
            <button className="wallet-dropdown-item" onClick={() => { onConnect(); setDropdownOpen(false); }}>
              Connect
            </button>
          )}
        </div>
      )}
    </div>
  );
}
