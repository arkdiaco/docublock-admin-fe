import type { TranslateService } from '@ngx-translate/core';
import { money } from '../../../shared/domain/money';
import type { PriceTerms } from './plan-format';

export const priceLabel = (
  terms: PriceTerms,
  translate: TranslateService,
  locale: string,
): string => {
  if (terms.negotiated) return translate.instant('plans.negotiated') as string;
  if (terms.kind === 'PACKAGE') {
    return translate.instant('plans.packagePrice', {
      price: money(terms.priceOnce ?? 0, terms.currency, locale),
      months: terms.validityMonths ?? 0,
    }) as string;
  }
  if (terms.priceMonthly === 0) return translate.instant('plans.free') as string;
  return translate.instant('plans.perMonth', {
    price: money(terms.priceMonthly, terms.currency, locale),
  }) as string;
};
