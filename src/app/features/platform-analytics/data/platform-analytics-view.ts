import type { Params } from '@angular/router';

const YEAR_PARAM = 'anio';
const MIN_YEAR = 2000;

export const yearOf = (params: Params, currentYear: number): number => {
  const year = Number(params[YEAR_PARAM]);
  return Number.isInteger(year) && year >= MIN_YEAR && year <= currentYear ? year : currentYear;
};

export const yearQueryParamsOf = (year: number, currentYear: number): Params => ({
  [YEAR_PARAM]: year === currentYear ? null : year,
});

export const yearOptionsOf = (
  firstYear: number,
  currentYear: number,
  selected: number,
): { id: number; label: string }[] => {
  const from = Math.min(firstYear, selected, currentYear);
  return Array.from({ length: currentYear - from + 1 }, (_, index) => {
    const year = currentYear - index;
    return { id: year, label: String(year) };
  });
};

export const shareOf = (count: number, total: number): number =>
  total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
