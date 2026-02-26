'use client';

import React from 'react';

type Props = {
  connected: boolean;
  address: string | null;
  onOpenWallet: () => void;
};

export default function WalletSelector({ connected, address, onOpenWallet }: Props) {
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <button className="mint-wallet-selector" onClick={onOpenWallet}>
      <span className={`mint-wallet-dot ${connected ? 'connected' : ''}`} />
      {connected ? (
        <span>{shortAddress}</span>
      ) : (
        <span>Set Up Wallet</span>
      )}
    </button>
  );
}
