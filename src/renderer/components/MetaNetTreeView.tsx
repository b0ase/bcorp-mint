import React from 'react';
import type { MetaNetNodeUI } from '@shared/lib/types';
import { CONDITION_COLORS } from '../lib/protocol-conditions';

type Props = {
  nodes: Map<string, MetaNetNodeUI>;
  rootId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
};

function TreeNode({
  nodeId,
  depth,
  nodes,
  selectedId,
  onSelect,
  onToggle,
}: {
  nodeId: string;
  depth: number;
  nodes: Map<string, MetaNetNodeUI>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const node = nodes.get(nodeId);
  if (!node) return null;

  const isSelected = nodeId === selectedId;
  const isFolder = node.type === 'folder';
  const condColor = CONDITION_COLORS[node.protocolCondition.type];

  const statusDot =
    node.inscriptionStatus === 'inscribed' ? 'status-inscribed' :
    node.inscriptionStatus === 'inscribing' ? 'status-inscribing' :
    node.inscriptionStatus === 'failed' ? 'status-failed' :
    'status-pending';

  return (
    <>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(nodeId)}
      >
        {isFolder && (
          <span
            className={`tree-arrow ${node.expanded ? 'expanded' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggle(nodeId); }}
          >
            {'\u25B6'}
          </span>
        )}
        {!isFolder && <span className="tree-arrow-spacer" />}

        <span className={`tree-status-dot ${statusDot}`} />

        <span className="tree-icon">{isFolder ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>

        <span className="tree-name">{node.name}</span>

        {node.protocolCondition.type !== 'none' && (
          <span className="tree-condition-badge" style={{ color: condColor, borderColor: condColor }}>
            {node.protocolCondition.type}
          </span>
        )}

        {node.derivedAddress && (
          <span className="tree-address">
            {node.derivedAddress.slice(0, 6)}...
          </span>
        )}
      </div>

      {isFolder && node.expanded && node.children.map((childId) => (
        <TreeNode
          key={childId}
          nodeId={childId}
          depth={depth + 1}
          nodes={nodes}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

export default function MetaNetTreeView({ nodes, rootId, selectedId, onSelect, onToggle }: Props) {
  if (!rootId) {
    return (
      <div className="tree-empty">
        <p>No folder loaded</p>
        <p className="small muted">Drop a folder or click "Add Files" to begin</p>
      </div>
    );
  }

  return (
    <div className="metanet-tree">
      <TreeNode
        nodeId={rootId}
        depth={0}
        nodes={nodes}
        selectedId={selectedId}
        onSelect={onSelect}
        onToggle={onToggle}
      />
    </div>
  );
}
