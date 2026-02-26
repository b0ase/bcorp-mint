export type ProtocolCondition = {
  type: 'none' | '$401' | '$402' | '$403';
  identityLevel?: 1 | 2 | 3 | 4;     // $401: required identity strength
  priceSatoshis?: number;              // $402: content price
};

export const DEFAULT_CONDITION: ProtocolCondition = { type: 'none' };

export const CONDITION_LABELS: Record<ProtocolCondition['type'], string> = {
  none: 'None',
  $401: '$401 Identity',
  $402: '$402 Payment',
  $403: '$403 Securities',
};

export const CONDITION_COLORS: Record<ProtocolCondition['type'], string> = {
  none: '#5a5850',
  $401: '#4a9acf',
  $402: '#c9a84c',
  $403: '#cf4a4a',
};

export function conditionToOnChain(condition: ProtocolCondition): { condition: string; conditionData: string } {
  if (condition.type === 'none') return { condition: '', conditionData: '' };

  const data: Record<string, unknown> = {};
  if (condition.type === '$401' && condition.identityLevel) {
    data.identityLevel = condition.identityLevel;
  }
  if (condition.type === '$402' && condition.priceSatoshis) {
    data.priceSatoshis = condition.priceSatoshis;
  }

  return {
    condition: condition.type,
    conditionData: Object.keys(data).length > 0 ? JSON.stringify(data) : '',
  };
}
