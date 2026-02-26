import React from 'react';
import type { MetaNetNodeUI } from '@shared/lib/types';
import type { ProtocolCondition } from '../lib/protocol-conditions';
import { CONDITION_LABELS, CONDITION_COLORS } from '../lib/protocol-conditions';

type Props = {
  node: MetaNetNodeUI | null;
  onSetCondition: (id: string, condition: ProtocolCondition) => void;
  onCascade: (id: string, condition: ProtocolCondition) => void;
};

const conditionTypes: ProtocolCondition['type'][] = ['none', '$401', '$402', '$403'];

export default function ProtocolConditionPanel({ node, onSetCondition, onCascade }: Props) {
  if (!node) return null;

  const condition = node.protocolCondition;

  const handleTypeChange = (type: ProtocolCondition['type']) => {
    const newCondition: ProtocolCondition = { type };
    if (type === '$401') newCondition.identityLevel = 1;
    if (type === '$402') newCondition.priceSatoshis = 100;
    onSetCondition(node.id, newCondition);
  };

  return (
    <div className="protocol-condition-panel">
      <label className="panel-label">Protocol Condition</label>

      <div className="condition-segmented">
        {conditionTypes.map((type) => (
          <button
            key={type}
            className={`condition-segment ${condition.type === type ? 'active' : ''}`}
            style={condition.type === type ? { borderColor: CONDITION_COLORS[type], color: CONDITION_COLORS[type] } : undefined}
            onClick={() => handleTypeChange(type)}
          >
            {CONDITION_LABELS[type]}
          </button>
        ))}
      </div>

      {condition.type === '$401' && (
        <div className="condition-sub-control">
          <label className="small-label">Identity Level (1-4)</label>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={condition.identityLevel ?? 1}
            onChange={(e) => onSetCondition(node.id, { ...condition, identityLevel: Number(e.target.value) as 1 | 2 | 3 | 4 })}
          />
          <span className="range-value">Level {condition.identityLevel ?? 1}</span>
        </div>
      )}

      {condition.type === '$402' && (
        <div className="condition-sub-control">
          <label className="small-label">Price (satoshis)</label>
          <input
            type="number"
            min={1}
            value={condition.priceSatoshis ?? 100}
            onChange={(e) => onSetCondition(node.id, { ...condition, priceSatoshis: Number(e.target.value) })}
            className="input-sm"
          />
        </div>
      )}

      {node.type === 'folder' && condition.type !== 'none' && (
        <button
          className="btn-secondary btn-sm"
          onClick={() => onCascade(node.id, condition)}
          style={{ marginTop: 8 }}
        >
          Apply to all children
        </button>
      )}
    </div>
  );
}
