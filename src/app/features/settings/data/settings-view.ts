import type { SettingItem, SettingRange, SettingUnit, SettingValue } from './settings.models';

const WHOLE_NUMBER = /^\d+$/;
const INTEGER_LIST_SEPARATOR = /[\s,;]+/;

const asValues = (value: SettingValue): number[] => (Array.isArray(value) ? value : [value]);

const inRange = (value: number, range: SettingRange): boolean =>
  value >= range.min && value <= range.max;

const parseWhole = (text: string): number | null => (WHOLE_NUMBER.test(text) ? Number(text) : null);

export const draftOf = (value: SettingValue): string => asValues(value).join(', ');

export const sameSettingValue = (a: SettingValue, b: SettingValue): boolean =>
  JSON.stringify(asValues(a)) === JSON.stringify(asValues(b));

export const parseSettingDraft = (item: SettingItem, text: string): SettingValue | null => {
  const clean = text.trim();
  if (item.kind === 'integer') {
    const value = parseWhole(clean);
    return value !== null && inRange(value, item.technical) ? value : null;
  }
  const parts = clean.split(INTEGER_LIST_SEPARATOR).filter(Boolean);
  const values = parts.map(parseWhole);
  if (values.length === 0 || values.length > (item.maxItems ?? values.length)) return null;
  if (values.some((value) => value === null || !inRange(value, item.technical))) return null;
  const numbers = values as number[];
  if (new Set(numbers).size !== numbers.length) return null;
  return [...numbers].sort((a, b) => b - a);
};

export const isRecommended = (item: SettingItem, value: SettingValue): boolean =>
  asValues(value).every((one) => inRange(one, item.recommended));

export interface SettingValueLabel {
  key: string;
  params: { value: string };
}

export const valueLabelOf = (unit: SettingUnit, value: SettingValue): SettingValueLabel => {
  const values = asValues(value);
  const singular = values.length === 1 && values[0] === 1;
  return {
    key: `cfg.unit.${unit}${singular ? 'One' : ''}`,
    params: { value: values.join(', ') },
  };
};
