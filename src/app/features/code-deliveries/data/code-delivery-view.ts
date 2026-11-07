import type { Params } from '@angular/router';
import type { OrgState } from '../../../shared/domain/org-state';
import type { FilterPill } from '../../../shared/ui/filter-pills.component';
import {
  CODE_CHANNELS,
  CODE_PURPOSES,
  CODE_STATUSES,
  type CodeDeliveryCounts,
  type CodeDeliveryFilters,
  type CodeDeliveryRow,
  type CodeDeliveryStatus,
  type CodeDeliveryTotals,
} from './code-deliveries.models';

const PROBLEMS: readonly CodeDeliveryStatus[] = ['undelivered', 'failed'];

const HOUR = 3_600_000;

export const PERIODS: Readonly<Record<string, number>> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
  '90d': 90 * 24 * HOUR,
};

export const ALL = '';

const PARAM = {
  purpose: 'para',
  channel: 'canal',
  status: 'estado',
  organizationId: 'organizacion',
  period: 'periodo',
  page: 'pagina',
} as const;

const MONGO_ID = /^[a-f\d]{24}$/i;

const STATES: Record<CodeDeliveryStatus, OrgState> = {
  accepted: 'trial',
  sent: 'trial',
  delivered: 'active',
  read: 'active',
  undelivered: 'warning',
  failed: 'suspended',
};

export const codeStateOf = (status: CodeDeliveryStatus): OrgState => STATES[status] ?? 'closed';

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

export const filtersOf = (params: Params): CodeDeliveryFilters => {
  const organizationId = params[PARAM.organizationId];
  const page = Number(params[PARAM.page]);
  return {
    purpose: oneOf(CODE_PURPOSES, params[PARAM.purpose]),
    channel: oneOf(CODE_CHANNELS, params[PARAM.channel]),
    status: oneOf(CODE_STATUSES, params[PARAM.status]),
    organizationId:
      typeof organizationId === 'string' && MONGO_ID.test(organizationId) ? organizationId : null,
    period: oneOf(Object.keys(PERIODS), params[PARAM.period]),
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  };
};

export const queryParamsOf = (filters: CodeDeliveryFilters): Params => ({
  [PARAM.purpose]: filters.purpose,
  [PARAM.channel]: filters.channel,
  [PARAM.status]: filters.status,
  [PARAM.organizationId]: filters.organizationId,
  [PARAM.period]: filters.period,
  [PARAM.page]: filters.page > 1 ? filters.page : null,
});

export const fromOf = (period: string | null, now: number): string | null => {
  const span = period ? PERIODS[period] : undefined;
  return span ? new Date(now - span).toISOString() : null;
};

export const statusPills = (counts: CodeDeliveryCounts | null): FilterPill[] => [
  { key: ALL, labelKey: 'cdl.filter.all', count: counts ? totalOf(counts) : undefined },
  ...CODE_STATUSES.map((status) => ({
    key: status,
    labelKey: `cdl.status.${status}`,
    count: counts?.[status],
    danger: PROBLEMS.includes(status) && (counts?.[status] ?? 0) > 0,
  })),
];

export const totalOf = (counts: CodeDeliveryCounts): number =>
  CODE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);

export interface CodeDeliveryKpi {
  labelKey: string;
  total: number;
  parts: { status: CodeDeliveryStatus; count: number }[];
}

const kpiOf = (labelKey: string, counts: CodeDeliveryCounts): CodeDeliveryKpi => ({
  labelKey,
  total: totalOf(counts),
  parts: CODE_STATUSES.map((status) => ({ status, count: counts[status] ?? 0 })).filter(
    (part) => part.count > 0,
  ),
});

export const kpisOf = (totals: CodeDeliveryTotals): CodeDeliveryKpi[] =>
  CODE_CHANNELS.map((channel) => kpiOf(`cdl.channel.${channel}`, totals.byChannel[channel]));

export const detailOf = (row: Pick<CodeDeliveryRow, 'error' | 'errorCode'>): string =>
  [row.errorCode, row.error]
    .filter((part) => part !== undefined && part !== null && part !== '')
    .join(' · ') || '—';
