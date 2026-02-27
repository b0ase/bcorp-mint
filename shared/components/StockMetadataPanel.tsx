'use client';

import React from 'react';
import type { StockCertificateMetadata, StockShareClass } from '@shared/lib/types';

type Props = {
  metadata: StockCertificateMetadata;
  onChange: (patch: Partial<StockCertificateMetadata>) => void;
};

const SHARE_CLASSES: { value: StockShareClass; label: string }[] = [
  { value: 'common', label: 'Common Stock' },
  { value: 'preferred', label: 'Preferred Stock' },
  { value: 'class-a', label: 'Class A Shares' },
  { value: 'class-b', label: 'Class B Shares' },
  { value: 'convertible', label: 'Convertible Preferred' },
  { value: 'restricted', label: 'Restricted Stock' },
  { value: 'treasury', label: 'Treasury Stock' },
  { value: 'founders', label: 'Founders Shares' },
  { value: 'employee-options', label: 'Employee Options' },
];

export default function StockMetadataPanel({ metadata, onChange }: Props) {
  return (
    <div className="section">
      <h3>Certificate Details</h3>
      <div className="control-group">
        <label className="control-row">
          <span>Company Name</span>
          <input
            type="text"
            value={metadata.companyName}
            onChange={(e) => onChange({ companyName: e.target.value })}
          />
        </label>
        <label className="control-row">
          <span>State</span>
          <input
            type="text"
            value={metadata.stateOfIncorporation}
            onChange={(e) => onChange({ stateOfIncorporation: e.target.value })}
          />
        </label>
        <label className="control-row">
          <span>Share Class</span>
          <select
            value={metadata.shareClass}
            onChange={(e) => onChange({ shareClass: e.target.value as StockShareClass })}
          >
            {SHARE_CLASSES.map((sc) => (
              <option key={sc.value} value={sc.value}>{sc.label}</option>
            ))}
          </select>
        </label>
        <label className="control-row">
          <span>Shares</span>
          <input
            type="number"
            value={metadata.sharesAuthorized}
            onChange={(e) => onChange({ sharesAuthorized: Number(e.target.value) })}
            min={1}
          />
        </label>
        <label className="control-row">
          <span>Par Value</span>
          <input
            type="number"
            value={metadata.parValue}
            onChange={(e) => onChange({ parValue: Number(e.target.value) })}
            min={0}
            step={0.01}
          />
        </label>
        <label className="control-row">
          <span>Certificate #</span>
          <input
            type="text"
            value={metadata.certificateNumber}
            onChange={(e) => onChange({ certificateNumber: e.target.value })}
          />
        </label>
        <label className="control-row">
          <span>Holder Name</span>
          <input
            type="text"
            value={metadata.holderName}
            onChange={(e) => onChange({ holderName: e.target.value })}
            placeholder="Registered holder"
          />
        </label>
        <label className="control-row">
          <span>Issue Date</span>
          <input
            type="date"
            value={metadata.issueDate}
            onChange={(e) => onChange({ issueDate: e.target.value })}
          />
        </label>
        <label className="control-row">
          <span>CUSIP</span>
          <input
            type="text"
            value={metadata.cusip}
            onChange={(e) => onChange({ cusip: e.target.value })}
            placeholder="Optional"
          />
        </label>
        <label className="control-row">
          <span>Transfer Agent</span>
          <input
            type="text"
            value={metadata.transferAgent}
            onChange={(e) => onChange({ transferAgent: e.target.value })}
            placeholder="Optional"
          />
        </label>
      </div>
    </div>
  );
}
