import type { Params } from '@angular/router';
import { dayEnd, dayStart } from '../../billing/data/billing-view';
import type { ConsentFilters, ConsentRequest } from './consents.models';

const PARAM = {
  from: 'desde',
  to: 'hasta',
  organization: 'organizacion',
  policy: 'politica',
  search: 'buscar',
  page: 'pagina',
} as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID = /^[a-f\d]{24}$/i;

export const POLICY_PATTERN = /^(anterior|[A-Za-z0-9_.-]{1,60}(@\d{1,6})?)$/;
export const LEGACY_POLICY = 'anterior';
export const MAX_SEARCH = 120;

const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`))
    ? value
    : null;

const pageOf = (value: unknown): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const consentFiltersOf = (params: Params): ConsentFilters => ({
  from: dayOf(params[PARAM.from]),
  to: dayOf(params[PARAM.to]),
  organizationId:
    typeof params[PARAM.organization] === 'string' && OBJECT_ID.test(params[PARAM.organization])
      ? params[PARAM.organization]
      : null,
  policy:
    typeof params[PARAM.policy] === 'string' && POLICY_PATTERN.test(params[PARAM.policy])
      ? params[PARAM.policy]
      : '',
  search: typeof params[PARAM.search] === 'string' ? params[PARAM.search].slice(0, MAX_SEARCH) : '',
  page: pageOf(params[PARAM.page]),
});

export const consentQueryParamsOf = (filters: ConsentFilters): Params => ({
  [PARAM.from]: filters.from,
  [PARAM.to]: filters.to,
  [PARAM.organization]: filters.organizationId,
  [PARAM.policy]: filters.policy || null,
  [PARAM.search]: filters.search.trim() || null,
  [PARAM.page]: filters.page > 1 ? filters.page : null,
});

export const consentRangeInvalid = (filters: ConsentFilters): boolean =>
  !!filters.from && !!filters.to && filters.from > filters.to;

export const consentRequestOf = (filters: ConsentFilters, tz: string): ConsentRequest => ({
  ...(filters.from ? { from: dayStart(filters.from) } : {}),
  ...(filters.to ? { to: dayEnd(filters.to) } : {}),
  ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
  ...(filters.policy ? { policy: filters.policy } : {}),
  ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
  tz,
});
