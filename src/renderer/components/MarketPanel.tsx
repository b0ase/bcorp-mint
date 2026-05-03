// Marketplace panel — 1sat market client UI for magazines (and any
// inscription). Three sections:
//
//   1. List — convert the most-recent on-chain output into a listing
//      with a price + payout address.
//   2. My Listings — fetch and cancel your active listings.
//   3. Buy by txid — paste any listing/ordinal txid → buy.
//
// All operations are real BSV transactions via the new market IPC handlers
// in main/ordinal-market.ts (which use js-1sat-ord under the hood).

import React, { useCallback, useEffect, useState } from 'react';

type MyListing = {
  listingTxid: string;
  listingVout: number;
  ordinalTxid: string;
  ordinalVout: number;
  priceSats: number;
  title?: string;
};

export default function MarketPanel() {
  // ─── List ──────────────────────────────────────────────────────────
  const [listOrdinalTxid, setListOrdinalTxid] = useState('');
  const [listOrdinalVout, setListOrdinalVout] = useState('0');
  const [listPriceSats, setListPriceSats] = useState('1000000');
  const [listing, setListing] = useState(false);
  const [listResult, setListResult] = useState<string | null>(null);

  const onCreateListing = useCallback(async () => {
    if (!listOrdinalTxid.trim()) { setListResult('Paste the ordinal txid first.'); return; }
    setListing(true);
    setListResult('Listing on chain…');
    try {
      const r = await window.mint.marketCreateListing({
        ordinalTxid: listOrdinalTxid.trim(),
        ordinalVout: Number(listOrdinalVout) || 0,
        priceSats: Number(listPriceSats) || 1
      });
      setListResult(`Listed ✓ ${r.listingTxid.slice(0, 16)}…_${r.listingVout} @ ${r.priceSats} sats`);
      // Trigger refresh of My Listings
      void refreshListings();
    } catch (err) {
      setListResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setListing(false);
    }
  }, [listOrdinalTxid, listOrdinalVout, listPriceSats]);

  // ─── My Listings ───────────────────────────────────────────────────
  const [myListings, setMyListings] = useState<MyListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshListings = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const items = await window.mint.marketMyListings();
      setMyListings(items);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void refreshListings(); }, [refreshListings]);

  const onCancelListing = useCallback(async (l: MyListing) => {
    try {
      await window.mint.marketCancelListing({
        listingTxid: l.listingTxid,
        listingVout: l.listingVout
      });
      void refreshListings();
    } catch (err) {
      setRefreshError(`Cancel failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [refreshListings]);

  // ─── Buy by txid ───────────────────────────────────────────────────
  const [buyTxid, setBuyTxid] = useState('');
  const [buyVout, setBuyVout] = useState('0');
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<string | null>(null);

  const onBuy = useCallback(async () => {
    if (!buyTxid.trim()) { setBuyResult('Paste a listing txid.'); return; }
    setBuying(true);
    setBuyResult('Buying on chain…');
    try {
      const r = await window.mint.marketPurchaseListing({
        listingTxid: buyTxid.trim(),
        listingVout: Number(buyVout) || 0
      });
      setBuyResult(`Bought ✓ ordinal ${r.ordinalId} (tx ${r.txid.slice(0, 12)}…)`);
    } catch (err) {
      setBuyResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBuying(false);
    }
  }, [buyTxid, buyVout]);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>1sat Marketplace</div>

      {/* List */}
      <div style={sectionStyle}>
        <div style={subHeaderStyle}>List ordinal for sale</div>
        <input
          value={listOrdinalTxid}
          onChange={(e) => setListOrdinalTxid(e.target.value)}
          placeholder="ordinal txid (from Mint Ordinal / Inscribe Magazine)"
          style={inputStyle}
          disabled={listing}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={listOrdinalVout}
            onChange={(e) => setListOrdinalVout(e.target.value)}
            placeholder="vout"
            style={{ ...inputStyle, width: 60 }}
            disabled={listing}
          />
          <input
            value={listPriceSats}
            onChange={(e) => setListPriceSats(e.target.value)}
            placeholder="price (sats)"
            type="number"
            min={1}
            style={{ ...inputStyle, flex: 1 }}
            disabled={listing}
          />
        </div>
        <button onClick={onCreateListing} disabled={listing} style={primaryBtnStyle}>
          {listing ? 'Listing…' : 'List on Chain'}
        </button>
        {listResult && (
          <div style={{ fontSize: 11, opacity: 0.85, color: listResult.startsWith('Failed') ? '#ff7a7a' : '#9ad', wordBreak: 'break-all' }}>
            {listResult}
          </div>
        )}
      </div>

      {/* My Listings */}
      <div style={sectionStyle}>
        <div style={{ ...subHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>My active listings ({myListings.length})</span>
          <button onClick={refreshListings} disabled={refreshing} style={tinyBtnStyle}>
            {refreshing ? '…' : '↻'}
          </button>
        </div>
        {refreshError && <div style={{ fontSize: 10, color: '#ff7a7a' }}>{refreshError}</div>}
        {myListings.length === 0 && !refreshing && (
          <div style={{ fontSize: 11, opacity: 0.6 }}>No active listings.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflow: 'auto' }}>
          {myListings.map((l) => (
            <div key={`${l.listingTxid}_${l.listingVout}`} style={{
              padding: 6,
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11,
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}>
              <div style={{ fontWeight: 600 }}>
                {l.title || `${l.ordinalTxid.slice(0, 10)}…_${l.ordinalVout}`}
              </div>
              <div style={{ opacity: 0.7 }}>
                {l.priceSats.toLocaleString()} sats
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                <button onClick={() => onCancelListing(l)} style={{ ...tinyBtnStyle, fontSize: 10 }}>
                  Cancel listing
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Buy by txid */}
      <div style={sectionStyle}>
        <div style={subHeaderStyle}>Buy listing by txid</div>
        <input
          value={buyTxid}
          onChange={(e) => setBuyTxid(e.target.value)}
          placeholder="listing txid"
          style={inputStyle}
          disabled={buying}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={buyVout}
            onChange={(e) => setBuyVout(e.target.value)}
            placeholder="vout"
            style={{ ...inputStyle, width: 60 }}
            disabled={buying}
          />
          <button onClick={onBuy} disabled={buying} style={{ ...primaryBtnStyle, flex: 1 }}>
            {buying ? 'Buying…' : 'Buy'}
          </button>
        </div>
        {buyResult && (
          <div style={{ fontSize: 11, opacity: 0.85, color: buyResult.startsWith('Failed') ? '#ff7a7a' : '#9ad', wordBreak: 'break-all' }}>
            {buyResult}
          </div>
        )}
      </div>

      <div style={{ fontSize: 10, opacity: 0.6 }}>
        Listings are real BSV transactions (1sat market protocol). Visible on
        any 1sat indexer — bmovies-exchange, future exchange.npg-x.com, etc.
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 10,
  borderRadius: 6,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  marginTop: 12
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  paddingTop: 6,
  borderTop: '1px solid rgba(255,255,255,0.06)'
};

const headerStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.9,
  letterSpacing: 0.5,
  textTransform: 'uppercase'
};

const subHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  opacity: 0.75,
  letterSpacing: 0.5,
  textTransform: 'uppercase'
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  color: 'inherit',
  padding: '4px 6px',
  fontSize: 12,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'monospace'
};

const tinyBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 4,
  cursor: 'pointer',
  padding: '2px 6px',
  fontSize: 10,
  color: 'inherit'
};

const primaryBtnStyle: React.CSSProperties = {
  background: '#3a7afe',
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer'
};
