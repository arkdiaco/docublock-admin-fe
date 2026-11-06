import type {
  DocumentVersion,
  PlatformDocumentDetail,
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

export const awaitingSignatures = (doc: PlatformDocumentSummary): boolean =>
  doc.status.state === 0 && (doc.status.progress === 1 || doc.status.progress === 2);

export const inOpenTurn = (doc: PlatformDocumentDetail, signer: PlatformSigner): boolean =>
  !signer.checked && !doc.turn.onHold && signer.order === doc.turn.order;

export const canResend = (doc: PlatformDocumentDetail, signer: PlatformSigner): boolean =>
  awaitingSignatures(doc) && inOpenTurn(doc, signer);

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
