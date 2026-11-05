import type {
  SettingCharset,
  SettingItem,
  SettingKind,
  SettingRange,
  SettingUnit,
  SettingValue,
} from './settings.models';

type SettingScalar = number | string;

const WHOLE_NUMBER = /^\d+$/;
const INTEGER_LIST_SEPARATOR = /[\s,;]+/;
const LINE_BREAK = /\r?\n/;
const LINE_SEPARATOR = ' · ';
const CHARSETS: Record<SettingCharset, RegExp> = {
  name: /^[^<>"\\@\p{Cc}]+$/u,
  line: /^\P{Cc}+$/u,
};

const asValues = (value: SettingValue): SettingScalar[] => (Array.isArray(value) ? value : [value]);

const sizeOf = (value: SettingScalar): number => (typeof value === 'string' ? value.length : value);

const inRange = (value: number, range: SettingRange): boolean =>
  value >= range.min && value <= range.max;

const parseWhole = (text: string): number | null => (WHOLE_NUMBER.test(text) ? Number(text) : null);

const parseInteger = (item: SettingItem, text: string): number | null => {
  const value = parseWhole(text.trim());
  return value !== null && inRange(value, item.technical) ? value : null;
};

const parseIntegerList = (item: SettingItem, text: string): number[] | null => {
  const parts = text.trim().split(INTEGER_LIST_SEPARATOR).filter(Boolean);
  const values = parts.map(parseWhole);
  if (values.length === 0 || values.length > (item.maxItems ?? values.length)) return null;
  if (values.some((value) => value === null || !inRange(value, item.technical))) return null;
  const numbers = values as number[];
  if (new Set(numbers).size !== numbers.length) return null;
  return [...numbers].sort((a, b) => b - a);
};

const parseText = (item: SettingItem, text: string): string | null => {
  const clean = text.trim();
  if (!inRange(clean.length, item.technical)) return null;
  return CHARSETS[item.charset ?? 'line'].test(clean) ? clean : null;
};

const parseLines = (item: SettingItem, text: string): string[] | null => {
  const lines = text.split(LINE_BREAK).filter((line) => line.trim());
  if (lines.length === 0 || lines.length > (item.maxItems ?? lines.length)) return null;
  const values = lines.map((line) => parseText(item, line));
  return values.every((line): line is string => line !== null) ? values : null;
};

export const isTextKind = (kind: SettingKind): boolean => kind === 'text' || kind === 'text_list';

export const draftOf = (item: SettingItem): string =>
  asValues(item.value).join(item.kind === 'text_list' ? '\n' : ', ');

export const linesOf = (value: SettingValue): string[] => asValues(value).map(String);

export const sameSettingValue = (a: SettingValue, b: SettingValue): boolean =>
  JSON.stringify(asValues(a)) === JSON.stringify(asValues(b));

export const parseSettingDraft = (item: SettingItem, text: string): SettingValue | null => {
  switch (item.kind) {
    case 'integer':
      return parseInteger(item, text);
    case 'integer_list':
      return parseIntegerList(item, text);
    case 'text':
      return parseText(item, text);
    case 'text_list':
      return parseLines(item, text);
  }
};

export const isRecommended = (item: SettingItem, value: SettingValue): boolean =>
  asValues(value).every((one) => inRange(sizeOf(one), item.recommended));

export const rangeKeyOf = (kind: SettingKind): string => {
  if (kind === 'text') return 'cfg.rangeText';
  if (kind === 'text_list') return 'cfg.rangeLines';
  return 'cfg.range';
};

export const rangeParamsOf = (
  item: SettingItem,
  label: (value: number) => string,
): Record<string, string | number | null> =>
  isTextKind(item.kind)
    ? { ...item.recommended, maxItems: item.maxItems }
    : { min: label(item.recommended.min), max: label(item.recommended.max) };

export interface SettingValueLabel {
  key: string;
  params: { value: string };
}

export const valueLabelOf = (unit: SettingUnit, value: SettingValue): SettingValueLabel => {
  const values = asValues(value);
  const singular = values.length === 1 && values[0] === 1;
  return {
    key: `cfg.unit.${unit}${singular ? 'One' : ''}`,
    params: { value: values.join(unit === 'lines' ? LINE_SEPARATOR : ', ') },
  };
};
