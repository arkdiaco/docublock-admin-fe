import type { CustomNumber } from './communications.models';

export const MAX_CONTACTS = 10_000;
const MAX_PHONE = 40;
const MAX_NAME = 120;
const FIRST_SEPARATOR = /[,;\t]/;

export const TEXT_MAX = 500;

export const cleanVariable = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const parseNumbers = (text: string): CustomNumber[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.search(FIRST_SEPARATOR);
      const phone = (at < 0 ? line : line.slice(0, at)).trim().slice(0, MAX_PHONE);
      const name = at < 0 ? '' : line.slice(at + 1).trim().slice(0, MAX_NAME);
      return name ? { phone, name } : { phone };
    })
    .filter((number) => number.phone);

export const toggled = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(ids);
  if (!next.delete(id)) next.add(id);
  return next;
};

export const withAll = (ids: ReadonlySet<string>, more: readonly string[]): ReadonlySet<string> => {
  const next = new Set(ids);
  for (const id of more) {
    if (next.size >= MAX_CONTACTS) break;
    next.add(id);
  }
  return next;
};
