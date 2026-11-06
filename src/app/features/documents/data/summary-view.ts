import type {
  HiddenField,
  HiddenReason,
  LinkedRef,
  PlatformDocumentDetail,
} from './documents.models';
import { awaitingSignatures } from './document-view';

export const ORIGINS = ['WEB', 'API', 'BRIDGE', 'TITLE'] as const;

export const BLOCK_MODES = ['single', 'independent'] as const;

export const HIDDEN_REASONS: readonly HiddenReason[] = ['secret', 'html', 'signers'];

export const originKeyOf = (kind: string): string | null =>
  (ORIGINS as readonly string[]).includes(kind) ? `docs.origin.${kind}` : null;

export const blockModeKeyOf = (mode?: string): string | null =>
  mode && (BLOCK_MODES as readonly string[]).includes(mode) ? `docs.sum.blockMode.${mode}` : null;

export const portalText = (portal?: string): string =>
  portal ? `${portal.charAt(0).toUpperCase()}${portal.slice(1)}` : '—';

export const refText = (ref: LinkedRef): string =>
  [ref.name, ref.code].filter((part) => !!part).join(' · ') || ref.id;

export type TurnState = 'open' | 'empty' | 'held' | 'closed';

export const turnStateOf = (doc: PlatformDocumentDetail): TurnState => {
  if (!awaitingSignatures(doc)) return 'closed';
  if (doc.turn.onHold) return 'held';
  return doc.turn.pending > 0 ? 'open' : 'empty';
};

export interface InfoRow {
  key: string;
  value: string;
}

const textOf = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

export const infoRowsOf = (info?: Record<string, unknown>): InfoRow[] =>
  Object.entries(info ?? {}).map(([key, value]) => ({ key, value: textOf(value) }));

export interface HiddenGroup {
  reason: HiddenReason;
  paths: string[];
}

export const hiddenGroupsOf = (hidden: readonly HiddenField[]): HiddenGroup[] =>
  HIDDEN_REASONS.map((reason) => ({
    reason,
    paths: hidden.filter((field) => field.reason === reason).map((field) => field.path),
  })).filter((group) => group.paths.length > 0);
