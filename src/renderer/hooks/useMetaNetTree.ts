import { useState, useCallback } from 'react';
import type { MetaNetNodeUI } from '../lib/types';
import type { ProtocolCondition } from '../lib/protocol-conditions';
import { DEFAULT_CONDITION } from '../lib/protocol-conditions';

let nextNodeId = 1;

function genId(): string {
  return `mn-${nextNodeId++}`;
}

function getMimeType(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const mimes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
    json: 'application/json', html: 'text/html', css: 'text/css',
    js: 'text/javascript', ts: 'text/typescript',
  };
  return mimes[ext] || null;
}

type FsNode = {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  hash: string | null;
  mimeType: string | null;
  children: FsNode[];
};

function fsNodeToUI(
  fsNode: FsNode,
  parentId: string | null,
  rootPath: string,
  nodes: Map<string, MetaNetNodeUI>,
): string {
  const id = genId();
  const childIds: string[] = [];

  if (fsNode.isDirectory) {
    for (const child of fsNode.children) {
      const childId = fsNodeToUI(child, id, rootPath, nodes);
      childIds.push(childId);
    }
  }

  const node: MetaNetNodeUI = {
    id,
    name: fsNode.name,
    type: fsNode.isDirectory ? 'folder' : 'file',
    localPath: fsNode.path,
    metanetPath: fsNode.relativePath || '/',
    derivedAddress: null,
    hash: fsNode.hash,
    size: fsNode.size,
    mimeType: fsNode.isDirectory ? null : getMimeType(fsNode.name),
    protocolCondition: { ...DEFAULT_CONDITION },
    inscriptionStatus: 'pending',
    txid: null,
    tokenId: null,
    children: childIds,
    parentId,
    expanded: parentId === null, // Root is expanded by default
  };

  nodes.set(id, node);
  return id;
}

export function useMetaNetTree() {
  const [nodes, setNodes] = useState<Map<string, MetaNetNodeUI>>(new Map());
  const [rootId, setRootId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inscribing, setInscribing] = useState(false);

  const loadFolder = useCallback(async (folderPath: string) => {
    setLoading(true);
    try {
      // Use the scan-folder-tokenise IPC which doesn't filter by extension
      const result = await window.mint.scanFolderTokenise(folderPath);
      if (!result) return;

      const newNodes = new Map<string, MetaNetNodeUI>();
      const rid = fsNodeToUI(result, null, folderPath, newNodes);
      setNodes(newNodes);
      setRootId(rid);
      setSelectedId(rid);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setNodes((prev) => {
      const next = new Map(prev);
      const node = next.get(id);
      if (node && node.type === 'folder') {
        next.set(id, { ...node, expanded: !node.expanded });
      }
      return next;
    });
  }, []);

  const selectNode = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const setProtocolCondition = useCallback((id: string, condition: ProtocolCondition) => {
    setNodes((prev) => {
      const next = new Map(prev);
      const node = next.get(id);
      if (node) {
        next.set(id, { ...node, protocolCondition: condition });
      }
      return next;
    });
  }, []);

  const bulkSetProtocolCondition = useCallback((ids: string[], condition: ProtocolCondition) => {
    setNodes((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        const node = next.get(id);
        if (node) {
          next.set(id, { ...node, protocolCondition: condition });
        }
      }
      return next;
    });
  }, []);

  // Get all descendant IDs of a node (for cascading conditions)
  const getDescendantIds = useCallback((id: string): string[] => {
    const result: string[] = [];
    const node = nodes.get(id);
    if (!node) return result;
    for (const childId of node.children) {
      result.push(childId);
      result.push(...getDescendantIds(childId));
    }
    return result;
  }, [nodes]);

  // Flatten tree depth-first for inscription order
  const flattenDepthFirst = useCallback((): MetaNetNodeUI[] => {
    if (!rootId) return [];
    const result: MetaNetNodeUI[] = [];
    const walk = (id: string) => {
      const node = nodes.get(id);
      if (!node) return;
      result.push(node);
      for (const childId of node.children) {
        walk(childId);
      }
    };
    walk(rootId);
    return result;
  }, [nodes, rootId]);

  const updateNodeStatus = useCallback((id: string, status: MetaNetNodeUI['inscriptionStatus'], txid?: string) => {
    setNodes((prev) => {
      const next = new Map(prev);
      const node = next.get(id);
      if (node) {
        next.set(id, { ...node, inscriptionStatus: status, txid: txid ?? node.txid });
      }
      return next;
    });
  }, []);

  const selectedNode = selectedId ? nodes.get(selectedId) ?? null : null;

  return {
    nodes,
    rootId,
    selectedId,
    selectedNode,
    loading,
    inscribing,
    setInscribing,
    loadFolder,
    toggleExpand,
    selectNode,
    setProtocolCondition,
    bulkSetProtocolCondition,
    getDescendantIds,
    flattenDepthFirst,
    updateNodeStatus,
  };
}
