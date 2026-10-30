export interface PriceTier {
  minQuantity: number;
  discountPct: number;
}

export interface TierDraft {
  minQuantity: string;
  discountPct: string;
}

export const MAX_TIERS = 10;

const WHOLE = /^\d{1,7}$/;

export const tierDraftsOf = (tiers: readonly PriceTier[]): TierDraft[] =>
  tiers.map((tier) => ({
    minQuantity: String(tier.minQuantity),
    discountPct: String(tier.discountPct),
  }));

export const tiersOf = (drafts: readonly TierDraft[]): PriceTier[] =>
  drafts.map((draft) => ({
    minQuantity: Number(draft.minQuantity.trim()),
    discountPct: Number(draft.discountPct.trim()),
  }));

export const tierError = (drafts: readonly TierDraft[]): string => {
  if (drafts.length > MAX_TIERS) return 'tiers.tooMany';
  for (const [index, draft] of drafts.entries()) {
    const min = draft.minQuantity.trim();
    const pct = draft.discountPct.trim();
    if (!WHOLE.test(min) || Number(min) < 1) return 'tiers.quantityInvalid';
    if (!WHOLE.test(pct) || Number(pct) > 100) return 'tiers.discountInvalid';
    const previous = drafts[index - 1];
    if (previous && Number(min) <= Number(previous.minQuantity.trim())) return 'tiers.notAscending';
  }
  return '';
};

export const sameTiers = (a: readonly PriceTier[], b: readonly PriceTier[]): boolean =>
  a.length === b.length &&
  a.every(
    (tier, i) => tier.minQuantity === b[i].minQuantity && tier.discountPct === b[i].discountPct,
  );
