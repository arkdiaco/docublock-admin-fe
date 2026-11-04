import type {
  DocumentVersion,
  PlatformDocumentSummary,
  PlatformSigner,
  TraceEvent,
} from './documents.models';

export const ISSUE_VIEWS = ['blockchain', 'atascados'] as const;
export type IssueView = (typeof ISSUE_VIEWS)[number];
export type ListView = 'todos' | IssueView;

export const ISSUE_LIMIT = 50;
export const BULK_LIMIT = 100;

export { statusViewOf, type StatusView } from '../../../shared/domain/document-status-view';

export type ChainState = 'registered' | 'pending' | 'none';

export const chainStateOf = (doc: PlatformDocumentSummary): ChainState => {
  if (doc.anchored) return 'registered';
  return doc.status.progress === 3 && doc.status.state !== 4 ? 'pending' : 'none';
};

export const shortHash = (value?: string): string => {
  if (!value) return '—';
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
};

export const currentVersionId = (versions: readonly DocumentVersion[]): string | null =>
  versions.reduce<DocumentVersion | null>((top, v) => (!top || v.index > top.index ? v : top), null)
    ?.id ?? null;

export interface DocumentActions {
  finalize: boolean;
  cancel: boolean;
  regenerate: boolean;
  register: boolean;
}

export const documentActionsOf = (
  doc: PlatformDocumentSummary,
  signers: readonly PlatformSigner[],
): DocumentActions => {
  const { progress, state } = doc.status;
  const live = state !== 4;
  return {
    finalize: live && progress !== 3 && signers.length > 0 && signers.every((s) => s.checked),
    cancel: live,
    regenerate: state === 0 && progress !== 2,
    register: live && progress === 3 && !doc.anchored,
  };
};

export const currentTurn = (signers: readonly PlatformSigner[]): number | null => {
  const pending = signers.filter((s) => !s.checked).map((s) => s.order);
  return pending.length ? Math.min(...pending) : null;
};

export const canResend = (
  doc: PlatformDocumentSummary,
  signer: PlatformSigner,
  signers: readonly PlatformSigner[],
): boolean =>
  doc.status.state === 0 &&
  (doc.status.progress === 1 || doc.status.progress === 2) &&
  !signer.checked &&
  signer.order === currentTurn(signers);

export type CheckState = 'passed' | 'failed' | 'waiting';

export interface EvidenceRow {
  key: string;
  labelKey: string;
  state: CheckState;
  detail: string;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const checkStateOf = (entry: Record<string, unknown>): CheckState =>
  entry['passed'] === true ? 'passed' : entry['passed'] === false ? 'failed' : 'waiting';

const scoreOf = (entry: Record<string, unknown>, field: string): string => {
  const value = entry[field];
  const threshold = entry['threshold'];
  if (typeof value !== 'number') return '';
  return typeof threshold === 'number' ? `${value} / ${threshold}` : String(value);
};

const CHECKS: readonly { key: string; detail: (entry: Record<string, unknown>) => string }[] = [
  { key: 'liveness', detail: (e) => scoreOf(e, 'confidence') },
  { key: 'faceCompare', detail: (e) => scoreOf(e, 'score') },
  { key: 'faceMatch', detail: (e) => (typeof e['code'] === 'string' ? e['code'] : '') },
  {
    key: 'documentCheck',
    detail: (e) =>
      typeof e['documentNumber'] === 'string'
        ? e['documentNumber']
        : e['unreadable'] === true
          ? 'unreadable'
          : '',
  },
];

const FILES = [
  'selfie',
  'documentFront',
  'documentBack',
  'photoFront',
  'photoBack',
  'signature',
] as const;

export const evidenceRowsOf = (evidence: Record<string, unknown> | undefined): EvidenceRow[] => {
  const source = record(evidence);
  if (!source) return [];
  const checks = CHECKS.flatMap(({ key, detail }) => {
    const entry = record(source[key]);
    return entry
      ? [
          {
            key,
            labelKey: `docs.evidence.${key}`,
            state: checkStateOf(entry),
            detail: detail(entry),
          },
        ]
      : [];
  });
  const files = FILES.flatMap((key) =>
    record(source[key])
      ? [{ key, labelKey: `docs.evidence.${key}`, state: 'passed' as CheckState, detail: '' }]
      : [],
  );
  return [...checks, ...files];
};

export const traceKeyOf = (type: string, known: ReadonlySet<string>): string | null => {
  const key = type.replace(/[.-]/g, '_');
  return known.has(key) ? `docs.trace.${key}` : null;
};

export const traceReasonOf = (event: TraceEvent): string => {
  const reason = event.details?.['reason'];
  return typeof reason === 'string' ? reason.trim() : '';
};

export const actorKindOf = (event: TraceEvent): 'person' | 'system' =>
  event.actor.type === 'system' ? 'system' : 'person';
