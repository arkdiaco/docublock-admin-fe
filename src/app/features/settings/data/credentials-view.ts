import type { OrgState } from '../../../shared/domain/org-state';
import type { CredentialGroup, CredentialItem, CredentialState } from './settings.models';

const KNOWN_GROUPS = new Set([
  'commons',
  'signature',
  'bridge',
  'utility',
  'motor',
  'hc2',
  'smartHome',
]);

const KNOWN_KINDS = new Set([
  'url',
  'serviceKey',
  'user',
  'password',
  'certificate',
  'certificatePassword',
  'authorityCertificate',
  'product',
  'securityUser',
  'securityPassword',
]);

const STATES: Record<CredentialState, OrgState> = {
  configured: 'active',
  partial: 'warning',
  missing: 'closed',
};

export interface CredentialStateView {
  state: OrgState;
  labelKey: string;
}

export const knownCredentialGroups = (groups: readonly CredentialGroup[]): CredentialGroup[] =>
  groups.filter((group) => KNOWN_GROUPS.has(group.key));

export const credentialStateOf = (state: CredentialState): CredentialStateView => {
  const known = state in STATES ? state : 'missing';
  return { state: STATES[known], labelKey: `cfg.cred.state.${known}` };
};

export const pieceStateOf = (item: CredentialItem): CredentialStateView =>
  item.configured
    ? { state: 'active', labelKey: 'cfg.cred.piece.set' }
    : { state: 'closed', labelKey: 'cfg.cred.piece.unset' };

export const kindKeyOf = (item: CredentialItem): string | null =>
  KNOWN_KINDS.has(item.kind) ? `cfg.cred.kind.${item.kind}` : null;

export const piecesOf = (group: CredentialGroup): { set: number; total: number } => ({
  set: group.items.filter((item) => item.configured).length,
  total: group.items.length,
});
