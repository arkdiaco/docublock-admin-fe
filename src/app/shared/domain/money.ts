const LOCALE = 'es-CO';

export const formatPesos = (value: number): string =>
  `$ ${value.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;

export const formatCount = (value: number): string =>
  value.toLocaleString(LOCALE, { maximumFractionDigits: 0 });

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
