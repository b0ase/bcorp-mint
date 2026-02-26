import { useState, useCallback } from 'react';
import type { ProtocolCondition } from '../lib/protocol-conditions';
import { conditionToOnChain } from '../lib/protocol-conditions';

type TokeniseProgress = {
  stage: string;
  completed: number;
  total: number;
  currentPath?: string;
};

type TokeniseResult = {
  totalNodes: number;
  totalCost: number;
  rootTxid: string;
};

export function useFileTokenisation() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Map<string, ProtocolCondition>>(new Map());
  const [progress, setProgress] = useState<TokeniseProgress | null>(null);
  const [result, setResult] = useState<TokeniseResult | null>(null);
  const [estimate, setEstimate] = useState<{ nodes: number; estimatedSats: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const scanFolder = useCallback(async () => {
    const selected = await window.mint.selectFolder();
    if (!selected) return null;
    setFolderPath(selected.folder);
    return selected;
  }, []);

  const setCondition = useCallback((path: string, condition: ProtocolCondition) => {
    setConditions((prev) => {
      const next = new Map(prev);
      next.set(path, condition);
      return next;
    });
  }, []);

  const estimateCost = useCallback(async () => {
    if (!folderPath) return;
    const est = await window.mint.tokeniseEstimate(folderPath);
    setEstimate(est);
    return est;
  }, [folderPath]);

  const executeTokenise = useCallback(async (stampPath: string) => {
    if (!folderPath) return;
    setLoading(true);
    setProgress(null);
    setResult(null);

    try {
      // Convert conditions map to on-chain format
      const onChainConditions: Record<string, { condition: string; conditionData: string }> = {};
      conditions.forEach((cond, path) => {
        if (cond.type !== 'none') {
          onChainConditions[path] = conditionToOnChain(cond);
        }
      });

      const res = await window.mint.tokeniseFolder({
        folderPath,
        stampPath,
        conditions: Object.keys(onChainConditions).length > 0 ? onChainConditions : undefined,
      });

      setResult({
        totalNodes: res.totalNodes,
        totalCost: res.totalCost,
        rootTxid: res.root.txid,
      });
    } finally {
      setLoading(false);
    }
  }, [folderPath, conditions]);

  return {
    folderPath,
    conditions,
    progress,
    result,
    estimate,
    loading,
    scanFolder,
    setCondition,
    estimateCost,
    executeTokenise,
  };
}
