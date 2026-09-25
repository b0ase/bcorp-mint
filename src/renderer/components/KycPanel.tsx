import React, { useState } from 'react';

/**
 * Local KYC certificate issuance is paused. Identity verification happens
 * in bChat (bit-sign.online), which runs Veriff server-side and issues
 * certificates under bit-sign's root keys.
 */
export default function KycPanel() {
  const [cleared, setCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setError(null);
    try {
      await window.mint.kycOpenBitSign();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleClear() {
    setError(null);
    try {
      await window.mint.kycReset();
      setCleared(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="btms-form">
      <h3>Identity verification</h3>
      <p className="btms-dim">
        Identity verification happens in <b>bChat</b> at <b>bit-sign.online</b>, which
        runs the Veriff check server-side and issues a certificate under bit-sign&apos;s
        published root keys. The Mint no longer issues KYC certificates locally.
      </p>
      <p className="btms-dim">
        Issuing securities (stocks and bonds) is paused pending legal review.
      </p>
      <div className="btms-btn-row">
        <button type="button" className="btms-primary-btn" onClick={handleOpen}>
          Verify identity at bit-sign.online
        </button>
        <button type="button" className="btms-link-btn btms-danger-link" onClick={handleClear}>
          clear legacy local KYC data
        </button>
      </div>
      {cleared && <div className="btms-dim">Legacy local KYC data cleared.</div>}
      {error && <div className="btms-error">{error}</div>}
    </div>
  );
}
