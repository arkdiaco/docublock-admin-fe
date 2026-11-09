import type { Params } from '@angular/router';
import {
  COUNT_KEYS,
  type CountKey,
  type DetailFilters,
  type DetailItem,
  type DetailRequest,
  type DetailScope,
  type DetailType,
} from './consumption.models';
import { filtersOf, queryParamsOf, rangeOf } from './consumption-view';

const SCOPE_PATHS: Record<string, DetailScope> = {
  organizacion: 'organization',
  reseller: 'reseller',
};

const PARAM = { type: 'tipo', search: 'buscar', page: 'pagina' } as const;

export const MAX_SEARCH = 120;

export const scopeOf = (path: string | null): DetailScope | null =>
  (path && SCOPE_PATHS[path]) || null;

export const scopePathOf = (scope: DetailScope): string =>
  scope === 'organization' ? 'organizacion' : 'reseller';

const typeOf = (value: unknown): DetailType =>
  COUNT_KEYS.includes(value as CountKey) ? (value as CountKey) : 'todos';

const pageOf = (value: unknown): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const detailFiltersOf = (params: Params): DetailFilters => ({
  ...filtersOf(params),
  type: typeOf(params[PARAM.type]),
  search: typeof params[PARAM.search] === 'string' ? params[PARAM.search].slice(0, MAX_SEARCH) : '',
  page: pageOf(params[PARAM.page]),
});

export const detailQueryParamsOf = (filters: DetailFilters): Params => ({
  ...queryParamsOf(filters),
  [PARAM.type]: filters.type === 'todos' ? null : filters.type,
  [PARAM.search]: filters.search.trim() || null,
  [PARAM.page]: filters.page > 1 ? filters.page : null,
});

export const backParamsOf = (filters: DetailFilters): Params => {
  const params = queryParamsOf(filters);
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null));
};

export const detailRequestOf = (
  scope: DetailScope,
  entityId: string,
  filters: DetailFilters,
  tz: string,
): DetailRequest => ({
  scope,
  entityId,
  ...rangeOf(filters),
  ...(filters.type === 'todos' ? {} : { type: filters.type }),
  ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
  tz,
});

export const monthLabelOf = (month: string, locale: string): string => {
  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-15T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
};

export const monthsOfPage = (
  items: readonly DetailItem[],
): { month: string; items: DetailItem[] }[] =>
  items.reduce<{ month: string; items: DetailItem[] }[]>((groups, item) => {
    const last = groups[groups.length - 1];
    if (last?.month === item.month) last.items.push(item);
    else groups.push({ month: item.month, items: [item] });
    return groups;
  }, []);

export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
  } catch {
    return 'America/Bogota';
  }
};
