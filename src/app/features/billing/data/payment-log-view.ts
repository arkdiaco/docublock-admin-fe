import type { Params } from '@angular/router';
import type { OrgState } from '../../../shared/domain/org-state';
import type { FilterPill } from '../../../shared/ui/filter-pills.component';
import {
  PAYMENT_LOG_PROVIDERS,
  PAYMENT_LOG_RESULTS,
  PAYMENT_LOG_STAGES,
  type PaymentLogFilters,
  type PaymentLogResult,
  type PaymentLogRow,
  type PaymentLogTotals,
} from './payment-logs.models';

const HOUR = 3_600_000;

export const PERIODS: Readonly<Record<string, number>> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
  '90d': 90 * 24 * HOUR,
};

export const ALL = '';

export const KNOWN_OUTCOMES = [
  'applied',
  'duplicate',
  'ignored',
  'not_eligible',
  'unchanged',
  'unknown_link',
  'forwarded',
  'rejected',
  'failed',
] as const;

const PARAM = {
  result: 'resultado',
  provider: 'proveedor',
  stage: 'etapa',
  organizationId: 'organizacion',
  search: 'buscar',
  period: 'periodo',
  page: 'pagina',
} as const;

const MONGO_ID = /^[a-f\d]{24}$/i;
export const SEARCH_MAX = 200;

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const searchOf = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= SEARCH_MAX ? text : null;
};

export const filtersOf = (params: Params): PaymentLogFilters => {
  const organizationId = params[PARAM.organizationId];
  const page = Number(params[PARAM.page]);
  return {
    result: oneOf(PAYMENT_LOG_RESULTS, params[PARAM.result]),
    provider: oneOf(PAYMENT_LOG_PROVIDERS, params[PARAM.provider]),
    stage: oneOf(PAYMENT_LOG_STAGES, params[PARAM.stage]),
    organizationId:
      typeof organizationId === 'string' && MONGO_ID.test(organizationId) ? organizationId : null,
    search: searchOf(params[PARAM.search]),
    period: oneOf(Object.keys(PERIODS), params[PARAM.period]),
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  };
};

export const queryParamsOf = (filters: PaymentLogFilters): Params => ({
  [PARAM.result]: filters.result,
  [PARAM.provider]: filters.provider,
  [PARAM.stage]: filters.stage,
  [PARAM.organizationId]: filters.organizationId,
  [PARAM.search]: filters.search,
  [PARAM.period]: filters.period,
  [PARAM.page]: filters.page > 1 ? filters.page : null,
});

export const fromOf = (period: string | null, now: number): string | null => {
  const span = period ? PERIODS[period] : undefined;
  return span ? new Date(now - span).toISOString() : null;
};

export const okOf = (result: PaymentLogResult | null): boolean | null =>
  result === null ? null : result === 'ok';

export const resultPills = (totals: PaymentLogTotals | null): FilterPill[] => [
  { key: ALL, labelKey: 'plog.filter.all', count: totals?.all },
  { key: 'ok', labelKey: 'plog.result.ok', count: totals ? totals.all - totals.failed : undefined },
  {
    key: 'failed',
    labelKey: 'plog.result.failed',
    count: totals?.failed,
    danger: (totals?.failed ?? 0) > 0,
  },
];

export const isKnownOutcome = (outcome: string | null): boolean =>
  !!outcome && (KNOWN_OUTCOMES as readonly string[]).includes(outcome);

const OUTCOME_STATES: Partial<Record<string, OrgState>> = {
  ignored: 'closed',
  duplicate: 'closed',
  unchanged: 'closed',
  not_eligible: 'warning',
  unknown_link: 'warning',
};

export const logStateOf = (row: Pick<PaymentLogRow, 'ok' | 'outcome'>): OrgState => {
  if (!row.ok) return 'suspended';
  return (row.outcome && OUTCOME_STATES[row.outcome]) || 'active';
};

export const logLabelKeyOf = (row: Pick<PaymentLogRow, 'ok' | 'outcome'>): string => {
  if (!row.ok) return 'plog.result.failed';
  return isKnownOutcome(row.outcome) ? `plog.outcome.${row.outcome}` : 'plog.result.ok';
};

export const failureText = (row: Pick<PaymentLogRow, 'error'>): string => {
  const error = row.error;
  if (!error) return '';
  return [error.status, error.code, error.message]
    .filter((part) => part !== undefined && part !== null && part !== '')
    .join(' · ');
};

export const prettyJson = (value: unknown): string =>
  value === undefined ? '—' : JSON.stringify(value, null, 2);

export const durationText = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
