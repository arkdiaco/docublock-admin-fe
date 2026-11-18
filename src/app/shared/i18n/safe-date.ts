import { formatDate } from '@angular/common';

export type DateInput = string | number | Date | null | undefined;

export const safeDate = (
  value: DateInput,
  format: string,
  locale: string,
  timezone?: string,
  fallback = '—',
): string => {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return formatDate(value, format, locale, timezone);
  } catch {
    return fallback;
  }
};
