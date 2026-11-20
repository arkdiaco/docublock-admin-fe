import type { PlatformFilingView } from './org-filing.models';

const PREFIX_PATTERN = /^[A-Z0-9]{2,8}$/;

export const normalizeFilingPrefix = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const isFilingPrefix = (value: string): boolean => PREFIX_PATTERN.test(value);

export const filingExample = (prefix: string, year: number): string => `${prefix}-${year}-E-000001`;

export const filingYearOf = (at: Date): number =>
  Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric' }).format(at),
  );

export const hasFiling = (view: PlatformFilingView | null): boolean =>
  !!view && (view.balance.unlimited || view.balance.remaining > 0 || !!view.prefix);
