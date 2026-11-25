import type { TicketSummary } from './support.models';

export type FailureGroup = 'quality' | 'data' | 'identity' | 'otp' | 'technical';
export type NoticeTarget = 'signer' | 'owner';

export interface FailureRecord {
  code: string;
  group: FailureGroup;
  hint?: string;
  blocked: boolean;
  attempts?: number;
  max?: number;
  at: string;
}

export interface NoticeRecord {
  to: NoticeTarget;
  sent: boolean;
  phone?: string;
  messageId?: string;
  error?: string;
  at: string;
}

export interface AutomaticFailure {
  documentName?: string;
  signerEmail?: string;
  failures: FailureRecord[];
  notices: NoticeRecord[];
}

const ORIGIN = 'signing_failure';
const GROUPS: readonly FailureGroup[] = ['quality', 'data', 'identity', 'otp', 'technical'];
const TARGETS: readonly NoticeTarget[] = ['signer', 'owner'];

export const KNOWN_FAILURE_CODES: readonly string[] = [
  'SELFIE_BAJA_CALIDAD',
  'CEDULA_ILEGIBLE',
  'IDENTIDAD_NO_COINCIDE',
  'CEDULA_NO_COINCIDE',
  'ROSTRO_NO_COINCIDE',
  'IDENTIDAD_NO_VERIFICADA',
  'PRUEBA_DE_VIDA_FALLIDA',
  'OTP_AGOTADA',
  'OTP_NO_ENVIADO',
  'FIRMA_RECHAZADA',
  'BIOMETRIA_NO_DISPONIBLE',
];

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;
const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

const failureOf = (raw: unknown): FailureRecord | null => {
  if (!isRecord(raw) || !text(raw['code']) || !isDate(raw['at'])) return null;
  const group = raw['group'] as FailureGroup;
  if (!GROUPS.includes(group)) return null;
  return defined({
    code: raw['code'] as string,
    group,
    hint: text(raw['hint']),
    blocked: raw['blocked'] === true,
    attempts: count(raw['attempts']),
    max: count(raw['max']),
    at: raw['at'],
  });
};

const noticeOf = (raw: unknown): NoticeRecord | null => {
  if (!isRecord(raw) || !isDate(raw['at'])) return null;
  const to = raw['to'] as NoticeTarget;
  if (!TARGETS.includes(to)) return null;
  return defined({
    to,
    sent: raw['sent'] === true,
    phone: text(raw['phone']),
    messageId: text(raw['messageId']),
    error: text(raw['error']),
    at: raw['at'],
  });
};

const listOf = <T>(raw: unknown, read: (item: unknown) => T | null): T[] =>
  Array.isArray(raw) ? raw.map(read).filter((item): item is T => item !== null) : [];

export const automaticFailureOf = (
  ticket: Pick<TicketSummary, 'createdByType' | 'metadata'>,
): AutomaticFailure | null => {
  const meta = ticket.metadata;
  if (ticket.createdByType !== 'system' || meta['origin'] !== ORIGIN) return null;
  return defined({
    documentName: text(meta['documentName']),
    signerEmail: text(meta['signerEmail']),
    failures: listOf(meta['failures'], failureOf),
    notices: listOf(meta['notices'], noticeOf),
  });
};

export const failureReasonKeyOf = (failure: { code: string; hint?: string }): string => {
  if (failure.hint === 'recapture') return 'support.failure.reason.RECAPTURE';
  return KNOWN_FAILURE_CODES.includes(failure.code)
    ? `support.failure.reason.${failure.code}`
    : 'support.failure.reason.other';
};
