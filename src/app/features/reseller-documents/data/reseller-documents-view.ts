import type { Params } from '@angular/router';
import { dayEnd, dayStart } from '../../billing/data/billing-view';
import type { SignedDocumentsFilters, SignedDocumentsRequest } from './reseller-documents.models';

const PARAM = { reseller: 'reseller', from: 'desde', to: 'hasta', page: 'pagina' } as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID = /^[a-f\d]{24}$/i;

const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`))
    ? value
    : null;

const pageOf = (value: unknown): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export const signedFiltersOf = (params: Params): SignedDocumentsFilters => ({
  resellerId:
    typeof params[PARAM.reseller] === 'string' && OBJECT_ID.test(params[PARAM.reseller])
      ? params[PARAM.reseller]
      : null,
  from: dayOf(params[PARAM.from]),
  to: dayOf(params[PARAM.to]),
  page: pageOf(params[PARAM.page]),
});

export const signedQueryParamsOf = (filters: SignedDocumentsFilters): Params => ({
  [PARAM.reseller]: filters.resellerId,
  [PARAM.from]: filters.from,
  [PARAM.to]: filters.to,
  [PARAM.page]: filters.page > 1 ? filters.page : null,
});

export const signedRangeInvalid = (filters: SignedDocumentsFilters): boolean =>
  !!filters.from && !!filters.to && filters.from > filters.to;

export const signedRequestOf = (
  filters: SignedDocumentsFilters,
  tz: string,
): SignedDocumentsRequest => ({
  ...(filters.from ? { from: dayStart(filters.from) } : {}),
  ...(filters.to ? { to: dayEnd(filters.to) } : {}),
  tz,
});
