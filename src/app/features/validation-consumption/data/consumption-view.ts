import type { Params } from '@angular/router';
import { dayEnd, dayStart } from '../../billing/data/billing-view';
import {
  CONSUMPTION_VIEWS,
  COUNT_KEYS,
  type ConsumptionBilling,
  type ConsumptionCounts,
  type ConsumptionFilters,
  type ConsumptionView,
  type OrganizationConsumption,
  type ResellerConsumption,
} from './consumption.models';

const PARAM = { from: 'desde', to: 'hasta', view: 'vista' } as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`))
    ? value
    : null;

export const filtersOf = (params: Params): ConsumptionFilters => ({
  from: dayOf(params[PARAM.from]),
  to: dayOf(params[PARAM.to]),
  view: CONSUMPTION_VIEWS.includes(params[PARAM.view] as ConsumptionView)
    ? (params[PARAM.view] as ConsumptionView)
    : 'organizaciones',
});

export const queryParamsOf = (filters: ConsumptionFilters): Params => ({
  [PARAM.from]: filters.from,
  [PARAM.to]: filters.to,
  [PARAM.view]: filters.view === 'organizaciones' ? null : filters.view,
});

export const rangeInvalid = (filters: ConsumptionFilters): boolean =>
  !!filters.from && !!filters.to && filters.from > filters.to;

export const rangeOf = (filters: ConsumptionFilters): { from?: string; to?: string } => ({
  from: filters.from ? dayStart(filters.from) : undefined,
  to: filters.to ? dayEnd(filters.to) : undefined,
});

export type ConsumptionValue =
  | { kind: 'amount'; billing: ConsumptionBilling }
  | { kind: 'viaReseller' }
  | { kind: 'noPricing' }
  | { kind: 'none' };

export const organizationValueOf = (row: OrganizationConsumption): ConsumptionValue => {
  if (row.billedViaReseller) return { kind: 'viaReseller' };
  return row.billing ? { kind: 'amount', billing: row.billing } : { kind: 'noPricing' };
};

export const resellerValueOf = (row: ResellerConsumption): ConsumptionValue => {
  if (!row.resellerId) return { kind: 'none' };
  return row.billing ? { kind: 'amount', billing: row.billing } : { kind: 'noPricing' };
};

export interface CsvLabels {
  organization: string;
  reseller: string;
  organizations: string;
  types: Record<(typeof COUNT_KEYS)[number], string>;
  total: string;
  packages: string;
  value: string;
  currency: string;
  viaReseller: string;
  noPricing: string;
  noReseller: string;
}

const FORMULA = /^[=+\-@\t\r]/;

const cell = (value: string | number): string => {
  const text = String(value);
  const safe = FORMULA.test(text) ? `'${text}` : text;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const countCells = (counts: ConsumptionCounts): number[] => [
  ...COUNT_KEYS.map((key) => counts[key]),
  counts.total,
];

const valueCells = (value: ConsumptionValue, labels: CsvLabels): (string | number)[] => {
  if (value.kind === 'amount') return [value.billing.total, value.billing.currency];
  if (value.kind === 'viaReseller') return [labels.viaReseller, ''];
  if (value.kind === 'noPricing') return [labels.noPricing, ''];
  return ['', ''];
};

export const consumptionCsv = (
  view: ConsumptionView,
  rows: { organizations: OrganizationConsumption[]; resellers: ResellerConsumption[] },
  labels: CsvLabels,
): string => {
  const tail = [labels.total, labels.packages, labels.value, labels.currency];
  const types = COUNT_KEYS.map((key) => labels.types[key]);
  const lines: (string | number)[][] =
    view === 'organizaciones'
      ? [
          [labels.organization, labels.reseller, ...types, ...tail],
          ...rows.organizations.map((row) => [
            row.businessName,
            row.reseller?.businessName ?? '',
            ...countCells(row.counts),
            row.packages,
            ...valueCells(organizationValueOf(row), labels),
          ]),
        ]
      : [
          [labels.reseller, labels.organizations, ...types, ...tail],
          ...rows.resellers.map((row) => [
            row.resellerId ? row.businessName : labels.noReseller,
            row.organizations,
            ...countCells(row.counts),
            row.packages,
            ...valueCells(resellerValueOf(row), labels),
          ]),
        ];
  return lines.map((line) => line.map(cell).join(',')).join('\r\n');
};

export const csvFilename = (filters: ConsumptionFilters): string =>
  `consumo-validaciones-${filters.view}-${filters.from ?? 'inicio'}-${filters.to ?? 'hoy'}.csv`;
