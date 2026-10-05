export type OrgState = 'active' | 'trial' | 'warning' | 'suspended' | 'closed';

export type DotShape = 'circle' | 'ring' | 'square' | 'dash';

export interface OrgStateView {
  key: OrgState;
  labelKey: string;
  descKey: string;
  shape: DotShape;
}

export const ORG_STATES: readonly OrgStateView[] = [
  { key: 'active', labelKey: 'org.state.active', descKey: 'org.stateDesc.active', shape: 'circle' },
  { key: 'trial', labelKey: 'org.state.trial', descKey: 'org.stateDesc.trial', shape: 'ring' },
  { key: 'warning', labelKey: 'org.state.warning', descKey: 'org.stateDesc.warning', shape: 'square' },
  { key: 'suspended', labelKey: 'org.state.suspended', descKey: 'org.stateDesc.suspended', shape: 'square' },
  { key: 'closed', labelKey: 'org.state.closed', descKey: 'org.stateDesc.closed', shape: 'dash' },
];

export const orgStateOf = (key: string): OrgStateView =>
  ORG_STATES.find((state) => state.key === key) ?? ORG_STATES[ORG_STATES.length - 1];

export type QuotaTone = 'ok' | 'warn' | 'over';

export const quotaToneOf = (used: number, limit: number | null): QuotaTone => {
  if (limit === null || limit <= 0) return 'ok';
  const ratio = used / limit;
  if (ratio >= 1) return 'over';
  if (ratio >= 0.9) return 'warn';
  return 'ok';
};
