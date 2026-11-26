import type { Params } from '@angular/router';
import {
  SIGNATURE_PERIODS,
  periodRangeOf,
  signatureFiltersOf,
  signatureQueryParamsOf,
  signatureRangeIssue,
  type SignatureFilters,
  type SignaturePeriod,
  type SignatureRangeIssue,
} from '../../platform-analytics/data/signature-filters';
import type { IdenticaReportRequest } from './identica-report.models';

export const IDENTICA_PERIODS = SIGNATURE_PERIODS;

export interface IdenticaFilters {
  period: SignaturePeriod;
  from: string | null;
  to: string | null;
}

const asSignatureFilters = (filters: IdenticaFilters): SignatureFilters => ({
  ...filters,
  organizationId: null,
  channel: 'todos',
});

export const identicaFiltersOf = (params: Params): IdenticaFilters => {
  const { period, from, to } = signatureFiltersOf(params);
  return { period, from, to };
};

export const identicaQueryParamsOf = (filters: IdenticaFilters): Params => {
  const { periodo, desde, hasta } = signatureQueryParamsOf(asSignatureFilters(filters));
  return { periodo, desde, hasta };
};

export const identicaRangeIssue = (
  filters: IdenticaFilters,
  today: string,
): SignatureRangeIssue | null => signatureRangeIssue(asSignatureFilters(filters), today);

export const identicaRequestOf = (
  filters: IdenticaFilters,
  today: string,
  tz: string,
): IdenticaReportRequest => ({
  ...periodRangeOf(asSignatureFilters(filters), today),
  tz,
});
