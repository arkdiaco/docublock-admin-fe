import { traceReasonOf } from './document-view';
import type { TraceEvent } from './documents.models';

export interface TraceText {
  key: string;
  params?: Record<string, string | number>;
}

export interface TraceLine extends TraceText {
  failed?: boolean;
  terms?: readonly TraceText[];
}

export interface RemovedSigner {
  identityId: string;
  name: string;
}

export interface TraceReading {
  titleKey: string | null;
  lines: TraceLine[];
  failed: boolean;
  copy?: RemovedSigner;
  cut?: RemovedSigner;
}

type Details = Record<string, unknown>;
type Entry = TraceLine | null;

interface Part {
  titleKey?: string;
  lines: Entry[];
  failed?: boolean;
  ownsReason?: boolean;
  copy?: RemovedSigner;
  cut?: RemovedSigner;
}

const EMAIL_SKIPPED = 'correo omitido por el firmante';
const EMAIL_MISSING = 'sin correo';
const PHONE_MISSING = 'sin celular';

const FAILURE_TYPES: ReadonlySet<string> = new Set([
  'document.close_failed',
  'report.validation_failed',
  'certificate.failed',
  'blockchain.queue_failed',
  'blockchain.failed',
  'blockchain.unavailable',
  'signature.block_propagation_failed',
  'signature.flow_propagation_failed',
  'identity.failed',
  'identity.blocked',
  'otp.failed',
  'plan.document_not_consumed',
]);

const INVITATIONS: ReadonlySet<string> = new Set(['notification.sent', 'notification.resent']);

const IDENTITY_FIELDS: ReadonlySet<string> = new Set([
  'email',
  'phone',
  'expeditionDate',
  'birthDate',
  'expeditionCountryId',
  'expeditionCityId',
]);

const OTP_CHANNELS: ReadonlySet<string> = new Set(['email', 'sms', 'whatsapp']);

const ANCHOR_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'submitted',
  'anchored',
  'failed',
]);

const ANCHOR_OUTCOMES: ReadonlySet<string> = new Set([
  'registered',
  'renotified',
  'draining',
  'reopened',
  'queued',
]);

const REACTIVATION_SCOPES: ReadonlySet<string> = new Set(['biometric', 'document', 'registry']);

const SIGNER_FEATURES: ReadonlySet<string> = new Set([
  'identityValid',
  'biometricValid',
  'checkDataRegistry',
  'fullIdentity',
  'reqDocument',
  'skipEmail',
]);

const INVERTED_FEATURES: ReadonlySet<string> = new Set(['skipEmail']);

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const record = (value: unknown): Details | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Details) : null;

const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(text).filter((item) => item !== '') : [];

const amount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const present = (entries: readonly Entry[]): TraceLine[] =>
  entries.filter((entry): entry is TraceLine => entry !== null);

const percent = (score: number): number => Math.round(score <= 1 ? score * 100 : score);

const attemptLine = (details: Details): Entry => {
  const attempts = amount(details['attempts']);
  const max = amount(details['max']);
  if (attempts === null) return null;
  return max === null
    ? { key: 'docs.traceUi.attempt', params: { attempts } }
    : { key: 'docs.traceUi.attemptOf', params: { attempts, max } };
};

const mailLine = (details: Details, delivered: boolean): Entry => {
  const email = text(details['email']);
  const error = text(details['error']);
  if (details['sent'] === true)
    return email
      ? { key: 'docs.traceUi.mail.sentTo', params: { to: email } }
      : { key: 'docs.traceUi.mail.sent' };
  if (error === EMAIL_SKIPPED) return { key: 'docs.traceUi.mail.skipped' };
  if (error === EMAIL_MISSING) return { key: 'docs.traceUi.mail.missing', failed: !delivered };
  return error ? { key: 'docs.traceUi.mail.failed', params: { error }, failed: true } : null;
};

const whatsappLine = (details: Details): Entry => {
  if (details['whatsapp'] === true) return { key: 'docs.traceUi.whatsapp.sent' };
  if (details['whatsapp'] !== false) return null;
  const error = text(details['whatsappError']);
  if (error === PHONE_MISSING) return { key: 'docs.traceUi.whatsapp.missing' };
  return error
    ? { key: 'docs.traceUi.whatsapp.failed', params: { error }, failed: true }
    : { key: 'docs.traceUi.whatsapp.noCause', failed: true };
};

const invitation = (details: Details, resent: boolean): Part => {
  if (details['covered'] === true) return { titleKey: 'docs.traceUi.title.covered', lines: [] };
  const delivered = details['sent'] === true || details['whatsapp'] === true;
  const unsent = details['sent'] === false && !delivered;
  const total = amount(details['documentsInBlock']);
  const lines = present([
    mailLine(details, delivered),
    whatsappLine(details),
    total !== null && total > 1 ? { key: 'docs.traceUi.block', params: { total } } : null,
  ]);
  return {
    titleKey: unsent ? `docs.traceUi.title.${resent ? 'resentUnsent' : 'unsent'}` : undefined,
    lines,
    failed: unsent && lines.length === 0,
  };
};

const reminder = (details: Details): Part => {
  const email = text(details['email']);
  return { lines: [email ? { key: 'docs.traceUi.mail.sentTo', params: { to: email } } : null] };
};

const fieldTerm = (field: string): TraceText =>
  IDENTITY_FIELDS.has(field)
    ? { key: `docs.traceUi.field.${field}` }
    : { key: 'docs.traceUi.field.other', params: { name: field } };

const faceResult = (reason: string): TraceLine =>
  reason && reason !== 'lowScore'
    ? { key: 'docs.traceUi.identity.face', params: { reason }, failed: true }
    : { key: 'docs.traceUi.identity.faceLow', failed: true };

const faceLine = (details: Details): Entry => {
  const face = text(details['faceCompare']);
  return face ? faceResult(face) : null;
};

const scoreLine = (details: Details): Entry => {
  const score = amount(details['score']);
  return score === null
    ? null
    : { key: 'docs.traceUi.identity.score', params: { score: percent(score) } };
};

const faceCompared = (details: Details): Part => ({
  ownsReason: true,
  lines: [
    details['passed'] === false ? faceResult(text(details['reason'])) : null,
    scoreLine(details),
    details['captureSuspected'] === true
      ? { key: 'docs.traceUi.identity.capture', failed: true }
      : null,
  ],
});

const livenessChecked = (details: Details): Part => {
  const reason = text(details['reason']);
  const confidence = amount(details['confidence']);
  return {
    ownsReason: true,
    lines: [
      details['passed'] !== false
        ? null
        : reason
          ? { key: 'docs.traceUi.identity.liveness', params: { reason }, failed: true }
          : { key: 'docs.traceUi.identity.livenessFailed', failed: true },
      confidence === null
        ? null
        : { key: 'docs.traceUi.identity.confidence', params: { confidence: percent(confidence) } },
    ],
  };
};

const matchLine = (details: Details): Entry => {
  const quality = text(details['quality']);
  const code = text(details['faceMatch']);
  if (quality)
    return { key: 'docs.traceUi.identity.quality', params: { reason: quality }, failed: true };
  return code ? { key: 'docs.traceUi.identity.faceMatch', params: { code }, failed: true } : null;
};

const identity = (details: Details): Part => {
  const fields = Array.isArray(details['fields'])
    ? details['fields'].map(text).filter((field) => field !== '')
    : [];
  const variant = text(details['variant']);
  const wrongCodes = amount(details['otpAttempts']);
  const liveness = text(details['liveness']);
  return {
    lines: [
      fields.length > 0
        ? { key: 'docs.traceUi.identity.fields', terms: fields.map(fieldTerm), failed: true }
        : null,
      variant === 'basic' || variant === 'full'
        ? { key: `docs.traceUi.identity.variant.${variant}` }
        : null,
      wrongCodes === null
        ? null
        : { key: 'docs.traceUi.identity.otp', params: { total: wrongCodes }, failed: true },
      faceLine(details),
      scoreLine(details),
      liveness
        ? { key: 'docs.traceUi.identity.liveness', params: { reason: liveness }, failed: true }
        : null,
      matchLine(details),
      text(details['documentCheck']) === 'mismatch'
        ? { key: 'docs.traceUi.identity.documentMismatch', failed: true }
        : null,
      attemptLine(details),
    ],
  };
};

const otpDeliveries = (details: Details): Part => ({
  lines: (Array.isArray(details['deliveries']) ? details['deliveries'] : [])
    .filter(
      (delivery): delivery is Details =>
        typeof delivery === 'object' && delivery !== null && delivery['sent'] !== true,
    )
    .map((delivery): TraceLine => {
      const channel = text(delivery['channel']);
      const error = text(delivery['error']) || '—';
      return OTP_CHANNELS.has(channel)
        ? { key: `docs.traceUi.otp.${channel}`, params: { error }, failed: true }
        : { key: 'docs.traceUi.otp.other', params: { channel, error }, failed: true };
    }),
});

const anchorQueued = (details: Details): Part => {
  const status = text(details['status']);
  if (!status) return { lines: [] };
  return {
    lines: [
      ANCHOR_STATUSES.has(status)
        ? { key: `docs.traceUi.anchor.status.${status}` }
        : { key: 'docs.traceUi.anchor.statusOther', params: { status } },
    ],
  };
};

const anchorFailed = (details: Details): Part => {
  const code = text(details['code']);
  return {
    titleKey: details['definitive'] === true ? 'docs.traceUi.title.anchorGaveUp' : undefined,
    lines: [
      attemptLine(details),
      code ? { key: 'docs.traceUi.anchor.code', params: { code } } : null,
    ],
  };
};

const anchorRequested = (details: Details): Part => {
  const outcome = text(details['outcome']);
  const lastError = text(details['lastError']);
  const result = outcome === 'registered' && details['already'] === true ? 'already' : outcome;
  return {
    lines: [
      ANCHOR_OUTCOMES.has(outcome) ? { key: `docs.traceUi.anchor.outcome.${result}` } : null,
      lastError ? { key: 'docs.traceUi.anchor.lastError', params: { error: lastError } } : null,
    ],
  };
};

const registryLine = (details: Details): Entry => {
  const code = text(record(details['registry'])?.['code']);
  return code ? { key: 'docs.traceUi.registry', params: { code } } : null;
};

const nameTerm = (name: string): TraceText => ({ key: 'docs.traceUi.name', params: { name } });

const reactivated = (details: Details): Part => {
  const scopes = texts(details['scopes']).filter((scope) => REACTIVATION_SCOPES.has(scope));
  const attempts = amount(details['previousAttempts']);
  return {
    lines: [
      scopes.length > 0
        ? {
            key: 'docs.traceUi.react.scopes',
            terms: scopes.map((scope) => ({ key: `docs.react.scope.${scope}` })),
          }
        : null,
      details['wasBlocked'] === true ? { key: 'docs.traceUi.react.unblocked' } : null,
      attempts ? { key: 'docs.traceUi.react.attempts', params: { total: attempts } } : null,
      registryLine(details),
    ],
  };
};

const featuresTurned = (changes: Details, on: boolean): TraceText[] =>
  Object.entries(changes).flatMap(([feature, change]) => {
    const to = record(change)?.['to'];
    if (!SIGNER_FEATURES.has(feature) || typeof to !== 'boolean') return [];
    const shown = INVERTED_FEATURES.has(feature) ? !to : to;
    return shown === on ? [{ key: `docs.feat.${feature}` }] : [];
  });

const featuresChanged = (details: Details): Part => {
  const changes = record(details['changes']) ?? {};
  const on = featuresTurned(changes, true);
  const off = featuresTurned(changes, false);
  const removed = (
    Array.isArray(details['removedAttachments']) ? details['removedAttachments'] : []
  )
    .map((item) => text(record(item)?.['name']))
    .filter((name) => name !== '');
  const optional = texts(details['optionalAttachments']);
  return {
    lines: [
      on.length > 0 ? { key: 'docs.traceUi.feat.on', terms: on } : null,
      off.length > 0 ? { key: 'docs.traceUi.feat.off', terms: off } : null,
      removed.length > 0
        ? { key: 'docs.traceUi.feat.removed', terms: removed.map(nameTerm) }
        : null,
      optional.length > 0
        ? { key: 'docs.traceUi.feat.optional', terms: optional.map(nameTerm) }
        : null,
      registryLine(details),
    ],
  };
};

const accessOf = (access: Details): TraceLine => ({
  key: 'docs.traceUi.access',
  params: {
    links: amount(access['links']) ?? 0,
    sessions: amount(access['sessions']) ?? 0,
    handoffs: amount(access['handoffs']) ?? 0,
  },
});

const turnLine = (details: Details): Entry => {
  const from = amount(details['from']);
  const to = amount(details['to']);
  return from === null || to === null
    ? null
    : { key: 'docs.traceUi.turn.moved', params: { from, to } };
};

const signerRemoved = (details: Details): Part => {
  const name = text(details['name']);
  const identityId = text(details['identityId']);
  const who = [name, text(details['identification']), text(details['email'])]
    .filter((part) => part !== '')
    .join(' · ');
  const access = record(details['access']);
  const person = identityId ? { identityId, name: name || identityId } : null;
  return {
    lines: [
      who ? { key: 'docs.traceUi.removal.signer', params: { who } } : null,
      turnLine(record(details['turn']) ?? {}),
      details['nobodyPending'] === true ? { key: 'docs.traceUi.removal.nobody' } : null,
      details['formLeftPending'] === true ? { key: 'docs.traceUi.removal.form' } : null,
      access ? accessOf(access) : { key: 'docs.traceUi.removal.accessFailed', failed: true },
    ],
    ...(person && amount(details['copied']) ? { copy: person } : {}),
    ...(person && !access ? { cut: person } : {}),
  };
};

const linksRevoked = (details: Details): Part => {
  const documents = amount(details['documents']);
  return {
    lines: [
      accessOf(details),
      documents !== null && documents > 1
        ? { key: 'docs.traceUi.revoke.documents', params: { total: documents } }
        : null,
    ],
  };
};

const turnFixed = (details: Details): Part => {
  const pending = amount(details['pending']);
  return {
    lines: [
      turnLine(details),
      pending === null ? null : { key: 'docs.traceUi.turn.pending', params: { total: pending } },
    ],
  };
};

const READERS: ReadonlyMap<string, (details: Details) => Part> = new Map([
  ['notification.sent', (details: Details) => invitation(details, false)],
  ['notification.resent', (details: Details) => invitation(details, true)],
  ['notification.reminder', reminder],
  ['identity.failed', identity],
  ['identity.blocked', identity],
  ['evidence.face_compared', faceCompared],
  ['evidence.liveness_checked', livenessChecked],
  ['otp.failed', otpDeliveries],
  ['blockchain.queued', anchorQueued],
  ['blockchain.failed', anchorFailed],
  ['admin.blockchain_register_requested', anchorRequested],
  ['admin.validations_reactivated', reactivated],
  ['admin.signer_features_changed', featuresChanged],
  ['admin.signer_removed', signerRemoved],
  ['admin.signer_links_revoked', linksRevoked],
  ['admin.turn_fixed', turnFixed],
]);

export const traceReadingOf = (event: TraceEvent): TraceReading => {
  const details = event.details ?? {};
  const part = READERS.get(event.type)?.(details) ?? { lines: [] };
  const failure = FAILURE_TYPES.has(event.type);
  const reason = part.ownsReason ? '' : traceReasonOf(event);
  const cause = INVITATIONS.has(event.type) ? '' : text(details['error']);
  const lines = present([
    reason ? { key: 'docs.traceUi.reason', params: { reason }, failed: failure } : null,
    cause ? { key: 'docs.traceUi.cause', params: { cause }, failed: true } : null,
    ...part.lines,
  ]);
  return {
    titleKey: part.titleKey ?? null,
    lines,
    failed: failure || part.failed === true || lines.some((line) => line.failed === true),
    ...(part.copy ? { copy: part.copy } : {}),
    ...(part.cut ? { cut: part.cut } : {}),
  };
};
