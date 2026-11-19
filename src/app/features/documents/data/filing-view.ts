import type { DocumentFiling } from './documents.models';

export type FilingState = { kind: 'filed'; number: string } | { kind: 'pending' };

export const filingStateOf = (filing?: DocumentFiling): FilingState | null => {
  if (!filing) return null;
  return filing.number ? { kind: 'filed', number: filing.number } : { kind: 'pending' };
};
