import { sameTiers, tierDraftsOf, tierError, tiersOf } from './price-tiers';

describe('tramos de precio', () => {
  it('va y vuelve entre tramos y borradores', () => {
    const tiers = [
      { minQuantity: 100, discountPct: 0 },
      { minQuantity: 500, discountPct: 15 },
    ];
    expect(tiersOf(tierDraftsOf(tiers))).toEqual(tiers);
    expect(sameTiers(tiers, tiersOf(tierDraftsOf(tiers)))).toBe(true);
    expect(sameTiers(tiers, tiers.slice(1))).toBe(false);
  });

  it('exige cantidades crecientes y descuentos entre 0 y 100', () => {
    expect(tierError([])).toBe('');
    expect(tierError([{ minQuantity: '0', discountPct: '5' }])).toBe('tiers.quantityInvalid');
    expect(tierError([{ minQuantity: '10', discountPct: '101' }])).toBe('tiers.discountInvalid');
    expect(tierError([{ minQuantity: '10', discountPct: '' }])).toBe('tiers.discountInvalid');
    expect(
      tierError([
        { minQuantity: '300', discountPct: '5' },
        { minQuantity: '300', discountPct: '10' },
      ]),
    ).toBe('tiers.notAscending');
    expect(
      tierError(
        Array.from({ length: 11 }, (_, i) => ({ minQuantity: String(i + 1), discountPct: '0' })),
      ),
    ).toBe('tiers.tooMany');
  });
});
