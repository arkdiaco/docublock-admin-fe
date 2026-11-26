import type { Params } from '@angular/router';
import {
  IDENTICA_CATEGORIES,
  IDENTICA_CATEGORY_GROUP,
  IDENTICA_GROUPS,
  IDENTICA_SERVICES,
  type IdenticaCategory,
  type IdenticaExportRequest,
  type IdenticaGroup,
  type IdenticaQueriesRequest,
  type IdenticaReportRequest,
  type IdenticaService,
} from './identica-report.models';

export const IDENTICA_QUERIES_LIMIT = 20;

export interface IdenticaListFilters {
  group: IdenticaGroup | null;
  category: IdenticaCategory | null;
  service: IdenticaService | null;
  page: number;
}

const oneOf = <T extends string>(options: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : null;

const pageOf = (value: unknown): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const fitsGroup = (
  category: IdenticaCategory | null,
  group: IdenticaGroup | null,
): IdenticaCategory | null =>
  category && group && IDENTICA_CATEGORY_GROUP[category] !== group ? null : category;

export const identicaCategoriesFor = (group: IdenticaGroup | null): IdenticaCategory[] =>
  IDENTICA_CATEGORIES.filter((category) => !group || IDENTICA_CATEGORY_GROUP[category] === group);

export const identicaListFiltersOf = (params: Params): IdenticaListFilters => {
  const group = oneOf(IDENTICA_GROUPS, params['grupo']);
  return {
    group,
    category: fitsGroup(oneOf(IDENTICA_CATEGORIES, params['clasificacion']), group),
    service: oneOf(IDENTICA_SERVICES, params['servicio']),
    page: pageOf(params['pagina']),
  };
};

export const identicaListParamsOf = (filters: IdenticaListFilters): Params => ({
  grupo: filters.group,
  clasificacion: filters.category,
  servicio: filters.service,
  pagina: filters.page > 1 ? String(filters.page) : null,
});

export const isListFiltered = ({ group, category, service }: IdenticaListFilters): boolean =>
  !!(group || category || service);

export const withListChange = (
  current: IdenticaListFilters,
  change: Partial<IdenticaListFilters>,
): IdenticaListFilters => {
  const next = { ...current, ...change };
  if (change.page === undefined) next.page = 1;
  return { ...next, category: fitsGroup(next.category, next.group) };
};

export const identicaExportRequestOf = (
  filters: IdenticaListFilters,
  period: IdenticaReportRequest,
): IdenticaExportRequest => ({
  ...period,
  ...(filters.group ? { group: filters.group } : {}),
  ...(filters.category ? { category: filters.category } : {}),
  ...(filters.service ? { service: filters.service } : {}),
});

export const identicaQueriesRequestOf = (
  filters: IdenticaListFilters,
  period: IdenticaReportRequest,
): IdenticaQueriesRequest => ({
  ...identicaExportRequestOf(filters, period),
  page: filters.page,
  limit: IDENTICA_QUERIES_LIMIT,
});
