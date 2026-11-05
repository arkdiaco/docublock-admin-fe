import type { OrgState } from '../../../shared/domain/org-state';
import type { FilterPill } from '../../../shared/ui/filter-pills.component';
import type { KeyCounts, KeyRow, KeyState } from './integrations.models';

export const ALL_KEYS = '';

const STATES: Record<KeyState, OrgState> = {
  active: 'active',
  rotating: 'warning',
  expired: 'suspended',
  revoked: 'closed',
};

export const keyStateOf = (state: KeyState): OrgState => STATES[state];

export const canRevoke = (key: Pick<KeyRow, 'state'>): boolean => key.state === 'active' || key.state === 'rotating';

export const keyPills = (counts: KeyCounts | null): FilterPill[] => [
  { key: ALL_KEYS, labelKey: 'ikey.filter.all' },
  { key: 'expiring', labelKey: 'ikey.filter.expiring', count: counts?.expiring, danger: (counts?.expiring ?? 0) > 0 },
  { key: 'unused', labelKey: 'ikey.filter.unused', count: counts?.unused },
  { key: 'expired', labelKey: 'ikey.filter.expired', count: counts?.expired },
  { key: 'revoked', labelKey: 'ikey.filter.revoked' },
];
