const LOCALE = 'es-CO';

export const formatPesos = (value: number): string =>
  `$ ${value.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;

export const formatCount = (value: number): string => value.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
