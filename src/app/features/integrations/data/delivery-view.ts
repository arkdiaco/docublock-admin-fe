import type { OrgState } from '../../../shared/domain/org-state';
import type { FilterPill } from '../../../shared/ui/filter-pills.component';
import type { DeliveryRow, DeliveryStatus, OpenDeliveryCounts } from './integrations.models';

export const ALL_STATUSES = '';

const STATES: Record<DeliveryStatus, OrgState> = {
  delivered: 'active',
  pending: 'trial',
  failed: 'warning',
  exhausted: 'suspended',
};

export const deliveryStateOf = (status: DeliveryStatus): OrgState => STATES[status];

export const statusPills = (counts: OpenDeliveryCounts | null): FilterPill[] => [
  { key: ALL_STATUSES, labelKey: 'dlv.filter.all' },
  { key: 'failed', labelKey: 'dlv.filter.failed', count: counts?.failed, danger: (counts?.failed ?? 0) > 0 },
  { key: 'exhausted', labelKey: 'dlv.filter.exhausted', count: counts?.exhausted, danger: (counts?.exhausted ?? 0) > 0 },
  { key: 'pending', labelKey: 'dlv.filter.pending', count: counts?.pending },
  { key: 'delivered', labelKey: 'dlv.filter.delivered' },
];

export const resultOf = (row: Pick<DeliveryRow, 'lastStatusCode' | 'lastError'>): string =>
  [row.lastStatusCode, row.lastError].filter((part) => part !== null && part !== undefined && part !== '').join(' · ') ||
  '—';

export const prettyPayload = (payload: unknown): string => JSON.stringify(payload, null, 2);
