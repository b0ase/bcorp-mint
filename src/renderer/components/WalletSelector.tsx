import React, { useState } from 'react';
import type { WalletProviderType, WalletState } from '../lib/types';

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
  metanet: '\u{1F310}',
};

export default function WalletSelector({ walletState, onSwitchProvider, onConnect, onDisconnect, onOpenWalletView }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const shortAddress = walletState.masterAddress
    ? `${walletState.masterAddress.slice(0, 6)}...${walletState.masterAddress.slice(-4)}`
    : walletState.handle
      ? `@${walletState.handle}`
      : null;

  const handleStatusClick = () => {
    if (!walletState.connected && !walletState.masterAddress) {
      // No wallet at all — open wallet view directly
      onOpenWalletView();
    } else {
      setDropdownOpen(!dropdownOpen);
    }
  };

  return (
    <div className="wallet-selector" style={{ position: 'relative' }}>
      <button
        className="wallet-status"
        onClick={handleStatusClick}
      >
        <span className={`wallet-dot ${walletState.connected ? 'connected' : ''}`} />
        <span className="wallet-provider-icon">{PROVIDER_ICONS[walletState.provider]}</span>
        {walletState.connected ? (
          <span className="wallet-info">
            {shortAddress}
            {walletState.balance !== null && (
              <span className="wallet-balance"> ({walletState.balance.toLocaleString()} sats)</span>
            )}
          </span>
        ) : (
          <span className="wallet-info wallet-info-empty">Set Up Wallet</span>
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
              <span className="wallet-provider-icon">{PROVIDER_ICONS[p.type as WalletProviderType]}</span>
              <span>{p.label}</span>
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
            <span>Manage Wallet</span>
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
