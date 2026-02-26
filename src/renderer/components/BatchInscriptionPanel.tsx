import React, { useState, useEffect } from 'react';
import type { MetaNetNodeUI } from '../lib/types';

type Props = {
  nodes: MetaNetNodeUI[];
  inscribing: boolean;
  onStartInscription: () => void;
};

export default function BatchInscriptionPanel({ nodes, inscribing, onStartInscription }: Props) {
  const [estimate, setEstimate] = useState<{ nodes: number; estimatedSats: number } | null>(null);
  const [progress, setProgress] = useState<{ stage: string; completed: number; total: number } | null>(null);

  useEffect(() => {
    const cleanup = window.mint.onMetanetProgress((data) => {
      setProgress(data);
    });
    return cleanup;
  }, []);

  // Calculate stats from nodes
  const totalNodes = nodes.length;
  const inscribed = nodes.filter((n) => n.inscriptionStatus === 'inscribed').length;
  const failed = nodes.filter((n) => n.inscriptionStatus === 'failed').length;
  const pending = nodes.filter((n) => n.inscriptionStatus === 'pending').length;
  const estimatedCost = totalNodes * 500;

  const percent = totalNodes > 0 ? Math.round((inscribed / totalNodes) * 100) : 0;

  return (
    <div className="batch-inscription-panel">
      <label className="panel-label">Batch Inscription</label>

      <div className="inscription-stats">
        <div className="stat-row">
          <span className="stat-label">Total Nodes</span>
          <span className="stat-value">{totalNodes}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Estimated Cost</span>
          <span className="stat-value">{estimatedCost.toLocaleString()} sats</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Inscribed</span>
          <span className="stat-value accent">{inscribed}</span>
        </div>
        {failed > 0 && (
          <div className="stat-row">
            <span className="stat-label">Failed</span>
            <span className="stat-value danger">{failed}</span>
          </div>
        )}
      </div>

      {inscribing && progress && (
        <div className="inscription-progress">
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="progress-stage">{progress.stage}</p>
          {progress.currentPath && (
            <p className="progress-path small muted">{progress.currentPath}</p>
          )}
        </div>
      )}

      {!inscribing && inscribed === totalNodes && totalNodes > 0 && (
        <div className="inscription-complete">
          All {totalNodes} nodes inscribed successfully.
        </div>
      )}

      <button
        className="btn-primary"
        disabled={inscribing || pending === 0}
        onClick={onStartInscription}
        style={{ marginTop: 12, width: '100%' }}
      >
        {inscribing ? 'Inscribing...' : `Inscribe ${pending} Node${pending !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}
