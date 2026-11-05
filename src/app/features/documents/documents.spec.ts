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
import { traceReadingOf } from './data/trace-reading';

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

describe('Documentos: lo que dice cada evento', () => {
  const event = (type: string, details?: Record<string, unknown>): TraceEvent => ({
    type,
    timestamp: '2026-10-30T10:00:00.000Z',
    actor: { type: 'system' },
    details,
  });

  const keys = (reading: ReturnType<typeof traceReadingOf>) =>
    reading.lines.map((line) => line.key);

  it('la invitación por correo con el WhatsApp caído dice qué salió y qué no', () => {
    const reading = traceReadingOf(
      event('notification.sent', {
        sent: true,
        email: 'ana@x.co',
        whatsapp: false,
        whatsappError: 'La URL de destino no está permitida',
      }),
    );
    expect(reading.titleKey).toBeNull();
    expect(reading.lines).toEqual([
      { key: 'docs.traceUi.mail.sentTo', params: { to: 'ana@x.co' } },
      {
        key: 'docs.traceUi.whatsapp.failed',
        params: { error: 'La URL de destino no está permitida' },
        failed: true,
      },
    ]);
    expect(reading.failed).toBe(true);
  });

  it('una invitación que no salió por ningún canal se llama «no enviada»', () => {
    const sinCorreo = traceReadingOf(
      event('notification.sent', { sent: false, error: 'sin correo' }),
    );
    expect(sinCorreo.titleKey).toBe('docs.traceUi.title.unsent');
    expect(sinCorreo.lines).toEqual([{ key: 'docs.traceUi.mail.missing', failed: true }]);
    expect(sinCorreo.failed).toBe(true);

    const reenvio = traceReadingOf(
      event('notification.resent', { sent: false, error: 'SMTP caído' }),
    );
    expect(reenvio.titleKey).toBe('docs.traceUi.title.resentUnsent');
    expect(keys(reenvio)).toEqual(['docs.traceUi.mail.failed']);

    const antigua = traceReadingOf(event('notification.sent', { sent: false }));
    expect(antigua.titleKey).toBe('docs.traceUi.title.unsent');
    expect(antigua.failed).toBe(true);
  });

  it('el correo omitido a propósito no cuenta como falla y el WhatsApp sí lo entrega', () => {
    const omitido = traceReadingOf(
      event('notification.sent', { sent: false, error: 'correo omitido por el firmante' }),
    );
    expect(omitido.titleKey).toBe('docs.traceUi.title.unsent');
    expect(keys(omitido)).toEqual(['docs.traceUi.mail.skipped']);
    expect(omitido.failed).toBe(false);

    const porWhatsapp = traceReadingOf(
      event('notification.sent', { sent: false, error: 'sin correo', whatsapp: true }),
    );
    expect(porWhatsapp.titleKey).toBeNull();
    expect(porWhatsapp.lines).toEqual([
      { key: 'docs.traceUi.mail.missing', failed: false },
      { key: 'docs.traceUi.whatsapp.sent' },
    ]);
    expect(porWhatsapp.failed).toBe(false);

    const sinCelular = traceReadingOf(
      event('notification.sent', { sent: true, whatsapp: false, whatsappError: 'sin celular' }),
    );
    expect(keys(sinCelular)).toEqual(['docs.traceUi.mail.sent', 'docs.traceUi.whatsapp.missing']);
    expect(sinCelular.failed).toBe(false);
  });

  it('el WhatsApp fallido sin causa, el block y la invitación cubierta por el proceso', () => {
    const sinCausa = traceReadingOf(
      event('notification.sent', { sent: true, whatsapp: false, documentsInBlock: 3 }),
    );
    expect(sinCausa.lines).toEqual([
      { key: 'docs.traceUi.mail.sent' },
      { key: 'docs.traceUi.whatsapp.noCause', failed: true },
      { key: 'docs.traceUi.block', params: { total: 3 } },
    ]);
    expect(sinCausa.failed).toBe(true);

    const cubierta = traceReadingOf(event('notification.sent', { sent: false, covered: true }));
    expect(cubierta).toEqual({ titleKey: 'docs.traceUi.title.covered', lines: [], failed: false });
  });

  it('la validación fallida dice los datos, el puntaje y el intento', () => {
    const datos = traceReadingOf(
      event('identity.failed', {
        fields: ['email', 'phone', 'nationality'],
        variant: 'basic',
        attempts: 2,
        max: 6,
      }),
    );
    expect(datos.lines).toEqual([
      {
        key: 'docs.traceUi.identity.fields',
        terms: [
          { key: 'docs.traceUi.field.email' },
          { key: 'docs.traceUi.field.phone' },
          { key: 'docs.traceUi.field.other', params: { name: 'nationality' } },
        ],
        failed: true,
      },
      { key: 'docs.traceUi.identity.variant.basic' },
      { key: 'docs.traceUi.attemptOf', params: { attempts: 2, max: 6 } },
    ]);
    expect(datos.failed).toBe(true);

    const rostro = traceReadingOf(
      event('identity.failed', {
        kind: 'document',
        faceCompare: 'lowScore',
        score: 0.9556,
        attempts: 1,
      }),
    );
    expect(rostro.lines).toEqual([
      { key: 'docs.traceUi.identity.faceLow', failed: true },
      { key: 'docs.traceUi.identity.score', params: { score: 96 } },
      { key: 'docs.traceUi.attempt', params: { attempts: 1 } },
    ]);

    expect(
      keys(traceReadingOf(event('identity.blocked', { otpAttempts: 5, attempts: 3, max: 3 }))),
    ).toEqual(['docs.traceUi.identity.otp', 'docs.traceUi.attemptOf']);
    expect(
      keys(traceReadingOf(event('identity.failed', { faceMatch: 'SELFIE', quality: 'borrosa' }))),
    ).toEqual(['docs.traceUi.identity.quality']);
    expect(
      keys(
        traceReadingOf(event('identity.failed', { liveness: 'spoof', documentCheck: 'mismatch' })),
      ),
    ).toEqual(['docs.traceUi.identity.liveness', 'docs.traceUi.identity.documentMismatch']);
  });

  it('la comparación facial y Liveness dicen su resultado y su puntaje sin el código crudo', () => {
    const fallida = traceReadingOf(
      event('evidence.face_compared', {
        passed: false,
        score: 0,
        reason: 'lowScore',
        captureSuspected: true,
      }),
    );
    expect(fallida.lines).toEqual([
      { key: 'docs.traceUi.identity.faceLow', failed: true },
      { key: 'docs.traceUi.identity.score', params: { score: 0 } },
      { key: 'docs.traceUi.identity.capture', failed: true },
    ]);
    expect(fallida.failed).toBe(true);

    const aprobada = traceReadingOf(
      event('evidence.face_compared', { passed: true, score: 0.9689, captureSuspected: false }),
    );
    expect(aprobada.lines).toEqual([{ key: 'docs.traceUi.identity.score', params: { score: 97 } }]);
    expect(aprobada.failed).toBe(false);

    expect(
      traceReadingOf(event('evidence.liveness_checked', { passed: true, confidence: 98 })).lines,
    ).toEqual([{ key: 'docs.traceUi.identity.confidence', params: { confidence: 98 } }]);
    expect(
      keys(traceReadingOf(event('evidence.liveness_checked', { passed: false, reason: 'spoof' }))),
    ).toEqual(['docs.traceUi.identity.liveness']);
    expect(
      keys(traceReadingOf(event('evidence.liveness_checked', { passed: false, confidence: 0.4 }))),
    ).toEqual(['docs.traceUi.identity.livenessFailed', 'docs.traceUi.identity.confidence']);
  });

  it('los fallos de cierre, informe, cupo y clave dinámica dicen su causa', () => {
    const cierre = traceReadingOf(
      event('document.close_failed', { error: 'El servicio de firma rechazó la petición' }),
    );
    expect(cierre.lines).toEqual([
      {
        key: 'docs.traceUi.cause',
        params: { cause: 'El servicio de firma rechazó la petición' },
        failed: true,
      },
    ]);
    expect(cierre.failed).toBe(true);

    const cupo = traceReadingOf(event('plan.document_not_consumed', { reason: 'cupo agotado' }));
    expect(cupo.lines).toEqual([
      { key: 'docs.traceUi.reason', params: { reason: 'cupo agotado' }, failed: true },
    ]);

    const clave = traceReadingOf(
      event('otp.failed', {
        deliveries: [
          { channel: 'email', to: 'ana@x.co', sent: false, error: 'No se pudo entregar el correo' },
          { channel: 'sms', to: '300', sent: false, error: 'fetch failed' },
          { channel: 'fax', to: '1', sent: false },
        ],
      }),
    );
    expect(clave.lines).toEqual([
      {
        key: 'docs.traceUi.otp.email',
        params: { error: 'No se pudo entregar el correo' },
        failed: true,
      },
      { key: 'docs.traceUi.otp.sms', params: { error: 'fetch failed' }, failed: true },
      { key: 'docs.traceUi.otp.other', params: { channel: 'fax', error: '—' }, failed: true },
    ]);
  });

  it('el anclaje dice su estado, su intento y si ya no se reintenta', () => {
    const cola = traceReadingOf(event('blockchain.queued', { anchorId: 'a1', status: 'pending' }));
    expect(cola.lines).toEqual([{ key: 'docs.traceUi.anchor.status.pending' }]);
    expect(cola.failed).toBe(false);
    expect(keys(traceReadingOf(event('blockchain.queued', { status: 'raro' })))).toEqual([
      'docs.traceUi.anchor.statusOther',
    ]);

    const rendido = traceReadingOf(
      event('blockchain.failed', {
        code: 'RPC',
        reason: 'nodo caído',
        attempts: 5,
        definitive: true,
      }),
    );
    expect(rendido.titleKey).toBe('docs.traceUi.title.anchorGaveUp');
    expect(keys(rendido)).toEqual([
      'docs.traceUi.reason',
      'docs.traceUi.attempt',
      'docs.traceUi.anchor.code',
    ]);
    expect(traceReadingOf(event('blockchain.failed', { attempts: 1 })).titleKey).toBeNull();

    expect(
      keys(
        traceReadingOf(
          event('admin.blockchain_register_requested', { outcome: 'registered', already: true }),
        ),
      ),
    ).toEqual(['docs.traceUi.anchor.outcome.already']);
    const reabierto = traceReadingOf(
      event('admin.blockchain_register_requested', { outcome: 'reopened', lastError: 'gas' }),
    );
    expect(keys(reabierto)).toEqual([
      'docs.traceUi.anchor.outcome.reopened',
      'docs.traceUi.anchor.lastError',
    ]);
    expect(reabierto.failed).toBe(false);
  });

  it('un evento sin falla con razón no cuenta para «Solo lo que falló»', () => {
    const reading = traceReadingOf(event('admin.document_finalized', { reason: 'pedido' }));
    expect(reading).toEqual({
      titleKey: null,
      lines: [{ key: 'docs.traceUi.reason', params: { reason: 'pedido' }, failed: false }],
      failed: false,
    });
    expect(traceReadingOf(event('document.signed')).lines).toEqual([]);
  });

  it('cada frase que arma la lectura existe en español e inglés', () => {
    const muestras = [
      event('notification.sent', {
        sent: true,
        email: 'a@x.co',
        whatsapp: true,
        documentsInBlock: 2,
      }),
      event('notification.sent', { sent: true, whatsapp: false, whatsappError: 'x' }),
      event('notification.sent', { sent: true, whatsapp: false }),
      event('notification.sent', { sent: false, error: 'correo omitido por el firmante' }),
      event('notification.sent', {
        sent: false,
        error: 'sin correo',
        whatsappError: 'sin celular',
        whatsapp: false,
      }),
      event('notification.sent', { sent: false, covered: true }),
      event('notification.resent', { sent: false, error: 'x' }),
      event('notification.reminder', { email: 'a@x.co' }),
      event('identity.failed', {
        fields: [
          'email',
          'phone',
          'expeditionDate',
          'birthDate',
          'expeditionCountryId',
          'expeditionCityId',
          'x',
        ],
        variant: 'full',
        attempts: 1,
        max: 2,
      }),
      event('identity.failed', { variant: 'basic', otpAttempts: 5, faceCompare: 'otro', score: 0 }),
      event('identity.failed', {
        faceCompare: 'lowScore',
        liveness: 'x',
        faceMatch: 'X',
        attempts: 1,
      }),
      event('identity.failed', { faceMatch: 'X', quality: 'x', documentCheck: 'mismatch' }),
      event('otp.failed', {
        deliveries: ['email', 'sms', 'whatsapp', 'fax'].map((channel) => ({
          channel,
          sent: false,
        })),
      }),
      ...['pending', 'submitted', 'anchored', 'failed', 'raro'].map((status) =>
        event('blockchain.queued', { status }),
      ),
      event('blockchain.failed', { code: 'X', attempts: 1, definitive: true }),
      ...['registered', 'renotified', 'draining', 'reopened', 'queued'].map((outcome) =>
        event('admin.blockchain_register_requested', { outcome, lastError: 'x' }),
      ),
      event('admin.blockchain_register_requested', { outcome: 'registered', already: true }),
      event('document.close_failed', { error: 'x', reason: 'y' }),
      event('evidence.face_compared', { passed: false, score: 0.5, captureSuspected: true }),
      event('evidence.liveness_checked', { passed: false, confidence: 40 }),
    ];
    const usadas = new Set<string>();
    for (const muestra of muestras) {
      const reading = traceReadingOf(muestra);
      if (reading.titleKey) usadas.add(reading.titleKey);
      for (const line of reading.lines) {
        usadas.add(line.key);
        for (const term of line.terms ?? []) usadas.add(term.key);
      }
    }
    expect(usadas.size).toBeGreaterThan(50);
    for (const key of usadas) {
      expect(typeof leaf(es, key), key).toBe('string');
      expect(typeof leaf(en, key), key).toBe('string');
    }
  });
});
