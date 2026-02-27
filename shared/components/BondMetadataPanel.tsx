'use client';

import React from 'react';
import type { BondCertificateMetadata, BondType, PaymentFrequency } from '@shared/lib/types';

type Props = {
  metadata: BondCertificateMetadata;
  onChange: (patch: Partial<BondCertificateMetadata>) => void;
};

const BOND_TYPES: { value: BondType; label: string }[] = [
  { value: 'government', label: 'Government' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'zero-coupon', label: 'Zero-Coupon' },
  { value: 'convertible', label: 'Convertible' },
  { value: 'bearer', label: 'Bearer' },
  { value: 'savings', label: 'Savings' },
  { value: 'green', label: 'Green' },
];

const FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'annual', label: 'Annual' },
  { value: 'semi-annual', label: 'Semi-Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'at-maturity', label: 'At Maturity' },
];

export default function BondMetadataPanel({ metadata, onChange }: Props) {
  const isZeroCoupon = metadata.bondType === 'zero-coupon';
  const isBearer = metadata.bondType === 'bearer';

  return (
    <div className="section">
      <h3>Bond Details</h3>
      <div className="control-group">
        <label className="control-row">
          <span>Issuer Name</span>
          <input
            type="text"
            value={metadata.issuerName}
            onChange={(e) => onChange({ issuerName: e.target.value })}
          />
        </label>
        <label className="control-row">
          <span>Bond Type</span>
          <select
            value={metadata.bondType}
            onChange={(e) => onChange({ bondType: e.target.value as BondType })}
          >
            {BOND_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>
        </label>
        <label className="control-row">
          <span>Face Value</span>
          <input
            type="number"
            value={metadata.faceValue}
            onChange={(e) => onChange({ faceValue: Number(e.target.value) })}
            min={0}
            step={100}
          />
        </label>
        {!isZeroCoupon && (
          <label className="control-row">
            <span>Coupon Rate %</span>
            <input
              type="number"
              value={metadata.couponRate}
              onChange={(e) => onChange({ couponRate: Number(e.target.value) })}
              min={0}
              max={100}
              step={0.01}
            />
          </label>
        )}
        <label className="control-row">
          <span>Maturity Date</span>
          <input
            type="date"
            value={metadata.maturityDate}
            onChange={(e) => onChange({ maturityDate: e.target.value })}
          />
        </label>
        <label className="control-row">
          <span>Frequency</span>
          <select
            value={metadata.paymentFrequency}
            onChange={(e) => onChange({ paymentFrequency: e.target.value as PaymentFrequency })}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>
        <label className="control-row">
          <span>Certificate #</span>
          <input
            type="text"
            value={metadata.certificateNumber}
            onChange={(e) => onChange({ certificateNumber: e.target.value })}
          />
        </label>
        {!isBearer && (
          <label className="control-row">
            <span>Holder Name</span>
            <input
              type="text"
              value={metadata.holderName}
              onChange={(e) => onChange({ holderName: e.target.value })}
              placeholder="Registered holder"
            />
          </label>
        )}
        <label className="control-row">
          <span>Issue Date</span>
          <input
            type="date"
            value={metadata.issueDate}
            onChange={(e) => onChange({ issueDate: e.target.value })}
          />
        </label>
        <label className="control-row">
          <span>ISIN</span>
          <input
            type="text"
            value={metadata.isin}
            onChange={(e) => onChange({ isin: e.target.value })}
            placeholder="Optional"
          />
        </label>
      </div>
    </div>
  );
}
