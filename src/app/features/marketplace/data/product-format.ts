import type { TranslateService } from '@ngx-translate/core';
import { money } from '../../../shared/domain/money';
import type { PriceTier } from '../../../shared/domain/price-tiers';
import type { ProductRow } from './marketplace.models';

export const kindLabel = (row: Pick<ProductRow, 'kind' | 'creditType' | 'addonCode'>): string =>
  row.kind === 'ADDON'
    ? `mkt.addon.${row.addonCode ?? 'none'}`
    : `mkt.credit.${row.creditType ?? 'none'}`;

export const priceText = (
  row: Pick<ProductRow, 'kind' | 'unitPrice' | 'fromPrice' | 'currency'>,
  translate: TranslateService,
  locale: string,
): string => {
  if (row.kind === 'ADDON') {
    return translate.instant('mkt.perMonth', {
      amount: money(row.unitPrice, row.currency, locale),
    }) as string;
  }
  if (row.fromPrice < row.unitPrice) {
    return translate.instant('mkt.fromPrice', {
      from: money(row.fromPrice, row.currency, locale),
      unit: money(row.unitPrice, row.currency, locale),
    }) as string;
  }
  return translate.instant('mkt.perQuery', {
    amount: money(row.unitPrice, row.currency, locale),
  }) as string;
};

export const tiersText = (tiers: readonly PriceTier[], translate: TranslateService): string =>
  tiers.length === 0
    ? (translate.instant('mkt.noTiers') as string)
    : tiers
        .map(
          (tier) =>
            translate.instant('mkt.tierLine', {
              from: tier.minQuantity,
              pct: tier.discountPct,
            }) as string,
        )
        .join(' · ');

export const bulletsOf = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
