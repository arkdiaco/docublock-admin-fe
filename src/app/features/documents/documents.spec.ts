import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';
import { DOCUMENT_ERRORS } from './data/document-errors';
import {
  canResend,
  chainStateOf,
  currentTurn,
  documentActionsOf,
  evidenceRowsOf,
  shortHash,
  statusViewOf,
  traceKeyOf,
  traceReasonOf,
} from './data/document-view';
import type { PlatformDocumentSummary, PlatformSigner, TraceEvent } from './data/documents.models';
import { TRACE_KEYS } from './data/trace-keys';

const leaf = (catalog: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      catalog,
    );

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node === 'string'
    ? [prefix]
    : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
        leaves(v, prefix ? `${prefix}.${k}` : k),
      );

const summary = (
  progress: 0 | 1 | 2 | 3,
  state: 0 | 1 | 4 | 5 = 0,
  over: Partial<PlatformDocumentSummary> = {},
): PlatformDocumentSummary => ({
  id: 'd1',
  name: 'Contrato',
  organization: { id: 'o1' },
  status: { progress, state, label: '' },
  signedCount: 0,
  signerCount: 2,
  anchored: false,
  ...over,
});

const signer = (
  identityId: string,
  order: number,
  checked: boolean,
  over: Partial<PlatformSigner> = {},
): PlatformSigner => ({
  identityId,
  name: identityId,
  order,
  role: 'Firmante',
  checked,
  signingAttempts: 0,
  blocked: false,
  ...over,
});

describe('Documentos: estado y blockchain', () => {
  it('el estado del documento manda sobre el progreso de firma', () => {
    expect(statusViewOf({ progress: 3, state: 4, label: '' })).toEqual({
      family: 'suspended',
      labelKey: 'docs.status.cancelled',
    });
    expect(statusViewOf({ progress: 1, state: 5, label: '' }).labelKey).toBe('docs.status.lapsed');
    expect(statusViewOf({ progress: 3, state: 1, label: '' }).labelKey).toBe(
      'docs.status.archived',
    );
  });

  it('el progreso se pinta con la familia que le toca', () => {
    expect(statusViewOf({ progress: 3, state: 0, label: '' }).family).toBe('active');
    expect(statusViewOf({ progress: 2, state: 0, label: '' }).family).toBe('warning');
    expect(statusViewOf({ progress: 1, state: 0, label: '' }).family).toBe('trial');
    expect(statusViewOf({ progress: 0, state: 0, label: '' }).labelKey).toBe(
      'docs.status.rejected',
    );
  });

  it('blockchain: pendiente solo si está firmado y sin anclar; un anulado no queda pendiente', () => {
    expect(chainStateOf(summary(3, 0, { anchored: true }))).toBe('registered');
    expect(chainStateOf(summary(3))).toBe('pending');
    expect(chainStateOf(summary(3, 4))).toBe('none');
    expect(chainStateOf(summary(1))).toBe('none');
  });

  it('abrevia las huellas largas y deja las cortas', () => {
    expect(shortHash('0123456789abcdef0123456789abcdef')).toBe('01234567…89abcdef');
    expect(shortHash('abc')).toBe('abc');
    expect(shortHash(undefined)).toBe('—');
  });
});

describe('Documentos: acciones permitidas', () => {
  it('finalizar solo con todas las firmas y sin forzar', () => {
    expect(
      documentActionsOf(summary(2), [signer('a', 1, true), signer('b', 2, true)]).finalize,
    ).toBe(true);
    expect(
      documentActionsOf(summary(2), [signer('a', 1, true), signer('b', 2, false)]).finalize,
    ).toBe(false);
    expect(documentActionsOf(summary(3), [signer('a', 1, true)]).finalize).toBe(false);
    expect(documentActionsOf(summary(2), []).finalize).toBe(false);
  });

  it('un anulado no ofrece nada', () => {
    expect(documentActionsOf(summary(3, 4), [signer('a', 1, true)])).toEqual({
      finalize: false,
      cancel: false,
      regenerate: false,
      register: false,
    });
  });

  it('regenerar uno no se ofrece con firmas en curso ni fuera de activo', () => {
    expect(documentActionsOf(summary(2), []).regenerate).toBe(false);
    expect(documentActionsOf(summary(1, 1), []).regenerate).toBe(false);
    expect(documentActionsOf(summary(3), []).regenerate).toBe(true);
    expect(documentActionsOf(summary(1), []).regenerate).toBe(true);
  });

  it('registrar en blockchain solo firmado y sin anclar', () => {
    expect(documentActionsOf(summary(3), []).register).toBe(true);
    expect(documentActionsOf(summary(3, 0, { anchored: true }), []).register).toBe(false);
    expect(documentActionsOf(summary(2), []).register).toBe(false);
  });

  it('reenviar solo al firmante pendiente del turno actual de un documento pendiente', () => {
    const signers = [
      signer('a', 1, true),
      signer('b', 2, false),
      signer('c', 2, false),
      signer('d', 3, false),
    ];
    expect(currentTurn(signers)).toBe(2);
    expect(canResend(summary(2), signers[1], signers)).toBe(true);
    expect(canResend(summary(2), signers[2], signers)).toBe(true);
    expect(canResend(summary(2), signers[3], signers)).toBe(false);
    expect(canResend(summary(2), signers[0], signers)).toBe(false);
    expect(canResend(summary(2, 4), signers[1], signers)).toBe(false);
    expect(canResend(summary(3), signers[1], signers)).toBe(false);
  });
});

describe('Documentos: evidencias', () => {
  it('las validaciones salen con su resultado y su dato, y las capturas como capturadas', () => {
    const rows = evidenceRowsOf({
      liveness: { sessionId: 's', passed: true, confidence: 97, threshold: 90 },
      faceCompare: { passed: false, score: 61, threshold: 80 },
      documentCheck: { passed: false, unreadable: true },
      faceMatch: { code: 'pendiente' },
      selfie: { key: 'k', mime: 'image/png' },
      attempts: { biometric: 2 },
    });
    expect(rows).toEqual([
      { key: 'liveness', labelKey: 'docs.evidence.liveness', state: 'passed', detail: '97 / 90' },
      {
        key: 'faceCompare',
        labelKey: 'docs.evidence.faceCompare',
        state: 'failed',
        detail: '61 / 80',
      },
      {
        key: 'faceMatch',
        labelKey: 'docs.evidence.faceMatch',
        state: 'waiting',
        detail: 'pendiente',
      },
      {
        key: 'documentCheck',
        labelKey: 'docs.evidence.documentCheck',
        state: 'failed',
        detail: 'unreadable',
      },
      { key: 'selfie', labelKey: 'docs.evidence.selfie', state: 'passed', detail: '' },
    ]);
  });

  it('sin evidencia no inventa filas', () => {
    expect(evidenceRowsOf(undefined)).toEqual([]);
    expect(evidenceRowsOf({ liveness: null })).toEqual([]);
  });
});

describe('Documentos: trazabilidad', () => {
  const event = (type: string, details?: Record<string, unknown>): TraceEvent => ({
    type,
    timestamp: '2026-10-30T10:00:00.000Z',
    actor: { type: 'system' },
    details,
  });

  it('un tipo conocido usa su etiqueta y uno desconocido cae al código', () => {
    expect(traceKeyOf('otp.sent', TRACE_KEYS)).toBe('docs.trace.otp_sent');
    expect(traceKeyOf('admin.document_finalized', TRACE_KEYS)).toBe(
      'docs.trace.admin_document_finalized',
    );
    expect(traceKeyOf('signature.auto-completed', TRACE_KEYS)).toBe(
      'docs.trace.signature_auto_completed',
    );
    expect(traceKeyOf('algo.nuevo', TRACE_KEYS)).toBeNull();
  });

  it('la razón sale de los detalles cuando la hay', () => {
    expect(
      traceReasonOf(event('admin.document_finalized', { reason: '  pedido del cliente ' })),
    ).toBe('pedido del cliente');
    expect(traceReasonOf(event('otp.sent'))).toBe('');
  });

  it('cada tipo de trazabilidad conocido tiene etiqueta en español e inglés', () => {
    for (const key of TRACE_KEYS) {
      expect(typeof leaf(es, `docs.trace.${key}`)).toBe('string');
      expect(typeof leaf(en, `docs.trace.${key}`)).toBe('string');
    }
    expect(Object.keys(es.docs.trace).sort()).toEqual([...TRACE_KEYS].sort());
  });

  it('cada error conocido del core tiene frase, y hay una genérica', () => {
    for (const code of [...DOCUMENT_ERRORS, 'generic']) {
      expect(typeof leaf(es, `docs.error.${code}`)).toBe('string');
      expect(typeof leaf(en, `docs.error.${code}`)).toBe('string');
    }
  });

  it('el bloque docs tiene las mismas llaves en los dos idiomas', () => {
    expect(leaves(en.docs).sort()).toEqual(leaves(es.docs).sort());
    expect(leaves(en.orgPicker).sort()).toEqual(leaves(es.orgPicker).sort());
  });
});
