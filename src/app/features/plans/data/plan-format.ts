import type { PlanLimits, PlanRow, PlanVersion } from './plans.models';

export type PriceTerms = Pick<
  PlanRow,
  | 'kind'
  | 'currency'
  | 'priceMonthly'
  | 'priceAnnual'
  | 'priceOnce'
  | 'validityMonths'
  | 'negotiated'
>;

export const money = (amount: number, currency: string, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};

export const limitText = (value: number | null): string => (value === null ? '∞' : String(value));

export const LIMIT_LABEL: Record<keyof PlanLimits, string> = {
  documents: 'plans.limit.documents',
  idBiometric: 'plans.limit.idBiometric',
  idAni: 'plans.limit.idAni',
  idIdentity: 'plans.limit.idIdentity',
};

export const versionTerms = (version: PlanVersion, kind: PlanRow['kind']): PriceTerms => ({
  kind,
  currency: version.currency,
  priceMonthly: version.priceMonthly,
  priceAnnual: version.priceAnnual,
  priceOnce: version.priceOnce,
  validityMonths: version.validityMonths,
  negotiated: version.negotiated,
});
