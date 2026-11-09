import type { Params } from '@angular/router';
import { dayEnd, dayStart } from '../../billing/data/billing-view';
import type {
  HistoryFilters,
  HistoryOrganization,
  HistoryRequest,
} from './validation-history.models';

export const LAST_LEGACY_DAY = '2026-04-19';

export const NO_ORGANIZATION_NODE = 'none';

const PARAM = {
  reseller: 'reseller',
  organization: 'organizacion',
  from: 'desde',
  to: 'hasta',
} as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID = /^[a-f\d]{24}$/i;

const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`))
    ? value
    : null;

const idOf = (value: unknown): string | null =>
  typeof value === 'string' && OBJECT_ID.test(value) ? value : null;

export const historyFiltersOf = (params: Params): HistoryFilters => {
  const organizationId = idOf(params[PARAM.organization]);
  return {
    resellerId: organizationId ? null : idOf(params[PARAM.reseller]),
    organizationId,
    from: dayOf(params[PARAM.from]),
    to: dayOf(params[PARAM.to]) ?? LAST_LEGACY_DAY,
  };
};

export const historyQueryParamsOf = (filters: HistoryFilters): Params => ({
  [PARAM.reseller]: filters.resellerId,
  [PARAM.organization]: filters.organizationId,
  [PARAM.from]: filters.from,
  [PARAM.to]: filters.to === LAST_LEGACY_DAY ? null : filters.to,
});

export const historyRangeInvalid = (filters: HistoryFilters): boolean =>
  !!filters.from && filters.from > filters.to;

export const historyAfterCutoff = (filters: HistoryFilters): boolean =>
  !!filters.from && filters.from > LAST_LEGACY_DAY;

export const historyRequestOf = (filters: HistoryFilters, tz: string): HistoryRequest => ({
  ...(filters.organizationId
    ? { organizationId: filters.organizationId }
    : filters.resellerId
      ? { resellerId: filters.resellerId }
      : {}),
  ...(filters.from ? { from: dayStart(filters.from) } : {}),
  to: dayEnd(filters.to),
  tz,
});

export const nodeKeyOf = (node: HistoryOrganization): string =>
  node.organization?.id ?? NO_ORGANIZATION_NODE;
