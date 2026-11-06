import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';
import { DOCUMENT_ERRORS } from './data/document-errors';
import {
  canResend,
  chainStateOf,
  documentActionsOf,
  inOpenTurn,
  shortHash,
  statusViewOf,
  traceKeyOf,
  traceReasonOf,
} from './data/document-view';
import {
  REACTIVATION_SCOPES,
  type AttachmentChangeKind,
  type DocumentTurn,
  type PlatformDocumentDetail,
  type PlatformDocumentSummary,
  type PlatformSigner,
  type RequestedAttachment,
  type TraceEvent,
} from './data/documents.models';
import {
  IDENTITY_FEATURES,
  VALIDATION_FEATURES,
  attachmentChangesOf,
  changedFeaturesOf,
  featureValuesOf,
  isLocked,
  raisesRequirements,
  reactivationChoicesOf,
  registryCostOf,
  scopesOfChoice,
  signerChangeOf,
} from './data/signer-changes';
import {
  BLOCK_MODES,
  HIDDEN_REASONS,
  ORIGINS,
  blockModeKeyOf,
  hiddenGroupsOf,
  infoRowsOf,
  originKeyOf,
  portalText,
  refText,
  turnStateOf,
} from './data/summary-view';
import {
  APPROVAL_ITEMS,
  ATTEMPT_KINDS,
  REQUIREMENT_KEYS,
  SIGNER_STATE_LABEL,
  checkOf,
  filePartOf,
  itemDecisionsOf,
  locationText,
  otpChannelKey,
  panelKeyOf,
  scoreText,
  signerStateOf,
  sizeText,
  skipReasonKey,
} from './data/signer-view';
import { REASON_MIN, reasonReady } from './data/reason';
import { TRACE_KEYS } from './data/trace-keys';
import { traceReadingOf } from './data/trace-reading';
import {
  accessPhraseOf,
  emptiedOrdersOf,
  noticeReportOf,
  noticeWarningsOf,
  pendingNamesAt,
  removalDoneOf,
  removalSummaryOf,
  removalWarningsOf,
  revokeWarningsOf,
  setWarningsOf,
} from './data/turn-changes';
import { platformSigner } from './documents-test-kit';

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
  kind: 'WEB',
  organization: { id: 'o1' },
  status: { progress, state, label: '' },
  signedCount: 0,
  signerCount: 2,
  anchored: false,
  ...over,
});

const detailOf = (
  progress: 0 | 1 | 2 | 3,
  state: 0 | 1 | 4 | 5,
  turn: DocumentTurn,
  signers: PlatformSigner[],
): PlatformDocumentDetail => ({
  ...summary(progress, state),
  enabledValidations: { identityValid: false, biometricValid: false, checkDataRegistry: false },
  signers,
  versions: [],
  turn,
  fields: [],
  attachments: [],
  principalFolder: false,
  sourceTemplates: [],
});

const signer = (
  identityId: string,
  order: number,
  checked: boolean,
  over: Partial<PlatformSigner> = {},
): PlatformSigner => platformSigner({ identityId, name: identityId, order, checked, ...over });

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

  it('reenviar solo al pendiente del turno del core, y nunca con el turno en espera del aval', () => {
    const signers = [
      signer('a', 1, true),
      signer('b', 2, false),
      signer('c', 2, false),
      signer('d', 3, false),
    ];
    const turn = { order: 2, onHold: false, pending: 2 };
    const doc = detailOf(2, 0, turn, signers);
    expect(canResend(doc, signers[1])).toBe(true);
    expect(canResend(doc, signers[2])).toBe(true);
    expect(canResend(doc, signers[3])).toBe(false);
    expect(canResend(doc, signers[0])).toBe(false);
    expect(canResend(detailOf(2, 4, turn, signers), signers[1])).toBe(false);
    expect(canResend(detailOf(3, 0, turn, signers), signers[1])).toBe(false);
    expect(canResend(detailOf(2, 0, { ...turn, onHold: true }, signers), signers[1])).toBe(false);
  });

  it('con el turno del core sin pendientes, nadie del turno siguiente queda «en turno»', () => {
    const signers = [signer('a', 1, true), signer('b', 2, false)];
    const stuck = detailOf(2, 0, { order: 1, onHold: false, pending: 0 }, signers);
    expect(inOpenTurn(stuck, signers[1])).toBe(false);
    expect(canResend(stuck, signers[1])).toBe(false);
    expect(turnStateOf(stuck)).toBe('empty');
  });
});

describe('Documentos: resumen del documento', () => {
  it('el turno dice si está abierto, sin pendientes, en espera del aval o cerrado', () => {
    const signers = [signer('a', 1, false)];
    const turn = (pending: number, onHold = false) => ({ order: 1, onHold, pending });
    expect(turnStateOf(detailOf(1, 0, turn(1), signers))).toBe('open');
    expect(turnStateOf(detailOf(1, 0, turn(0), signers))).toBe('empty');
    expect(turnStateOf(detailOf(1, 0, turn(1, true), signers))).toBe('held');
    expect(turnStateOf(detailOf(3, 0, turn(0), signers))).toBe('closed');
    expect(turnStateOf(detailOf(1, 4, turn(1), signers))).toBe('closed');
  });

  it('origen, portal, modo del bloque y referencias con nombre o con su id', () => {
    expect(originKeyOf('BRIDGE')).toBe('docs.origin.BRIDGE');
    expect(originKeyOf('OTRO')).toBeNull();
    expect(blockModeKeyOf('single')).toBe('docs.sum.blockMode.single');
    expect(blockModeKeyOf('raro')).toBeNull();
    expect(blockModeKeyOf(undefined)).toBeNull();
    expect(portalText('arkdia')).toBe('Arkdia');
    expect(portalText(undefined)).toBe('—');
    expect(refText({ id: 't1', name: 'Arriendo', code: 'AR' })).toBe('Arriendo · AR');
    expect(refText({ id: 't1' })).toBe('t1');
  });

  it('los datos de la integración salen como texto y lo oculto se agrupa por razón', () => {
    expect(
      infoRowsOf({ externalRef: 'R-1', massiveRow: 4, editado: true, vacio: '', otro: { a: 1 } }),
    ).toEqual([
      { key: 'externalRef', value: 'R-1' },
      { key: 'massiveRow', value: '4' },
      { key: 'editado', value: 'true' },
      { key: 'vacio', value: '—' },
      { key: 'otro', value: '{"a":1}' },
    ]);
    expect(infoRowsOf(undefined)).toEqual([]);
    expect(
      hiddenGroupsOf([
        { path: 'pattern', reason: 'html' },
        { path: 'token', reason: 'secret' },
        { path: 'relatedInfo.apiKey', reason: 'secret' },
      ]),
    ).toEqual([
      { reason: 'secret', paths: ['token', 'relatedInfo.apiKey'] },
      { reason: 'html', paths: ['pattern'] },
    ]);
  });

  it('cada origen, modo de bloque y razón de ocultar tiene frase en los dos idiomas', () => {
    for (const key of [
      ...ORIGINS.map((origin) => `docs.origin.${origin}`),
      ...BLOCK_MODES.map((mode) => `docs.sum.blockMode.${mode}`),
      ...HIDDEN_REASONS.map((reason) => `docs.raw.reason.${reason}`),
    ]) {
      expect(typeof leaf(es, key), key).toBe('string');
      expect(typeof leaf(en, key), key).toBe('string');
    }
  });
});

describe('Documentos: panel del firmante', () => {
  const open = (signers: PlatformSigner[]) =>
    detailOf(2, 0, { order: 1, onHold: false, pending: 1 }, signers);

  it('el estado de la fila: bloqueado, luego por aprobar, luego en turno', () => {
    const pending = { status: 'pending', held: true };
    const doc = open([]);
    expect(signerStateOf(doc, signer('a', 1, false, { blocked: true, approval: pending }))).toBe(
      'blocked',
    );
    expect(signerStateOf(doc, signer('b', 1, false, { approval: pending }))).toBe('approval');
    expect(signerStateOf(doc, signer('c', 1, false))).toBe('turn');
    expect(
      signerStateOf(doc, signer('d', 2, false, { approval: { status: 'approved', held: false } })),
    ).toBe('enabled');
    expect(SIGNER_STATE_LABEL.approval).toBe('docs.signer.approval');
  });

  it('los resultados, puntajes, lugares y tamaños se leen sin inventar datos', () => {
    expect([checkOf(true), checkOf(false), checkOf(undefined)]).toEqual([
      'passed',
      'failed',
      'waiting',
    ]);
    expect(scoreText(97, 90)).toBe('97 / 90');
    expect(scoreText(97)).toBe('97');
    expect(scoreText(undefined, 90)).toBe('—');
    expect(locationText({ city: 'Bogotá', country: 'Colombia', countryCode: 'CO' })).toBe(
      'Bogotá, Colombia',
    );
    expect(locationText({ countryCode: 'CO' })).toBe('CO');
    expect(locationText(undefined)).toBe('—');
    expect([sizeText(512), sizeText(2048), sizeText(3 * 1024 * 1024), sizeText(0)]).toEqual([
      '512 B',
      '2 KB',
      '3.0 MB',
      '',
    ]);
    expect(otpChannelKey('whatsapp')).toBe('docs.sp.channel.whatsapp');
    expect(otpChannelKey('fax')).toBeNull();
    expect(skipReasonKey('no_reader')).toBe('docs.sp.doc.skip.no_reader');
    expect(skipReasonKey('otro')).toBeNull();
  });

  it('las decisiones por ítem solo listan lo que se decidió', () => {
    expect(itemDecisionsOf({ sign: true, photoFront: false })).toEqual([
      { item: 'sign', approved: true },
      { item: 'photoFront', approved: false },
    ]);
    expect(itemDecisionsOf(undefined)).toEqual([]);
  });

  it('cada botón del panel tiene su llave, con el historial aparte', () => {
    expect(panelKeyOf('i1', filePartOf('selfie'))).toBe('sp:i1:file:selfie');
    expect(panelKeyOf('i1', filePartOf('selfie', 0))).toBe('sp:i1:file:selfie:0');
  });

  it('cada requisito, intento, ítem, estado y archivo tiene frase en los dos idiomas', () => {
    for (const key of [
      ...REQUIREMENT_KEYS.map((req) => `docs.sp.req.${req}`),
      ...ATTEMPT_KINDS.map((kind) => `docs.sp.attempts.kind.${kind}`),
      ...APPROVAL_ITEMS.map((item) => `docs.sp.approval.item.${item}`),
      ...['pending', 'approved', 'rejected'].map((st) => `docs.sp.approval.status.${st}`),
      ...['active', 'expired', 'revoked', 'none'].map((st) => `docs.sp.link.states.${st}`),
      ...['otp', 'passkey', 'auto', 'propagated', 'unknown'].map((m) => `docs.sp.sign.method.${m}`),
      ...['mandatory', 'guarantor', 'legalRep'].map((t) => `docs.sp.type.${t}`),
      ...['none', 'holding', 'document'].map((mode) => `docs.sp.req.photo.${mode}`),
      ...['email', 'sms', 'whatsapp'].map((channel) => `docs.sp.channel.${channel}`),
      ...['full', 'basic'].map((variant) => `docs.sp.identity.variants.${variant}`),
      ...[
        'selfie',
        'documentFront',
        'documentBack',
        'photoFront',
        'photoBack',
        'signature',
        'identityDocument',
      ].map((kind) => `docs.evidence.${kind}`),
      ...Object.values(SIGNER_STATE_LABEL),
      'docs.sp.doc.skip.no_reader',
    ]) {
      expect(typeof leaf(es, key), key).toBe('string');
      expect(typeof leaf(en, key), key).toBe('string');
    }
  });
});

describe('Documentos: reactivar y cambiar características', () => {
  const attachment = (
    index: number,
    over: Partial<RequestedAttachment> = {},
  ): RequestedAttachment => ({
    index,
    name: `Adjunto ${index}`,
    info: '',
    required: true,
    includeInDocument: false,
    provided: false,
    ...over,
  });

  const file = {
    originalName: 'rut.pdf',
    mime: 'application/pdf',
    size: 2048,
    sha256: 'a'.repeat(64),
  };

  it('«Todo» solo sale con más de una validación y abarca todas', () => {
    expect(reactivationChoicesOf([])).toEqual([]);
    expect(reactivationChoicesOf(['registry'])).toEqual(['registry']);
    expect(reactivationChoicesOf(['biometric', 'document', 'registry'])).toEqual([
      'biometric',
      'document',
      'registry',
      'all',
    ]);
    expect(scopesOfChoice('all', ['biometric', 'registry'])).toEqual(['biometric', 'registry']);
    expect(scopesOfChoice('document', ['biometric', 'document'])).toEqual(['document']);
    expect(scopesOfChoice('registry', ['biometric'])).toEqual([]);
  });

  it('la consulta a Registraduría dice lo que cuesta, también cuando no quedan consultas', () => {
    expect(registryCostOf(undefined)).toEqual({ key: 'docs.registryCheck.plain' });
    expect(registryCostOf({ unlimited: true, remaining: 0 })).toEqual({
      key: 'docs.registryCheck.unlimited',
    });
    expect(registryCostOf({ unlimited: false, remaining: 7 })).toEqual({
      key: 'docs.registryCheck.count',
      params: { remaining: 7 },
    });
    expect(registryCostOf({ unlimited: false, remaining: 0 })).toEqual({
      key: 'docs.registryCheck.none',
    });
  });

  it('una validación que la organización no tiene no se enciende, pero la que ya tiene se apaga', () => {
    const enabled = { identityValid: true, biometricValid: false, checkDataRegistry: false };
    const before = featureValuesOf(
      platformSigner({
        requirements: { ...platformSigner().requirements, checkDataRegistry: true },
      }),
    );
    expect(isLocked('identityValid', before, enabled)).toBe(false);
    expect(isLocked('biometricValid', before, enabled)).toBe(true);
    expect(isLocked('checkDataRegistry', before, enabled)).toBe(false);
    for (const feature of IDENTITY_FEATURES) {
      expect(isLocked(feature, before, enabled), feature).toBe(false);
    }
  });

  it('solo se manda lo que cambió, y encender validaciones avisa que el firmante las completa', () => {
    const before = featureValuesOf(platformSigner());
    const changes = changedFeaturesOf(before, { ...before, identityValid: true, skipEmail: true });
    expect(changes).toEqual({ identityValid: true, skipEmail: true });
    expect(raisesRequirements(changes)).toBe(true);
    expect(
      raisesRequirements({ skipEmail: true, checkDataRegistry: true, identityValid: false }),
    ).toBe(false);
    expect(changedFeaturesOf(before, { ...before })).toEqual({});
  });

  it('lo que entregó la integración no se toca y volver opcional lo opcional no cuenta', () => {
    const items = [
      attachment(0, { provided: true, file }),
      attachment(1),
      attachment(2, { required: false }),
      attachment(3, { required: false, file }),
    ];
    const marks = new Map<number, AttachmentChangeKind>([
      [0, 'remove'],
      [1, 'optional'],
      [2, 'optional'],
      [3, 'remove'],
    ]);
    const changes = attachmentChangesOf(items, marks);
    expect(changes).toEqual([
      { index: 1, name: 'Adjunto 1', change: 'optional' },
      { index: 3, name: 'Adjunto 3', change: 'remove' },
    ]);
    expect(signerChangeOf({ reqDocument: true }, changes)).toEqual({
      reqDocument: true,
      attachments: changes,
    });
    expect(signerChangeOf({ reqDocument: true }, [])).toEqual({ reqDocument: true });
    expect(signerChangeOf({}, [])).toEqual({});
  });

  it('cada opción, característica y aviso tiene frase en los dos idiomas', () => {
    for (const key of [
      ...[...REACTIVATION_SCOPES, 'all'].map((scope) => `docs.react.scope.${scope}`),
      ...[...VALIDATION_FEATURES, ...IDENTITY_FEATURES].flatMap((feature) => [
        `docs.feat.${feature}`,
        `docs.feat.hint.${feature}`,
      ]),
      ...['plain', 'unlimited', 'count', 'none', 'done'].map((k) => `docs.registryCheck.${k}`),
      'docs.signer.reactivate',
      'docs.signer.features',
      'docs.sp.attempts.reactivations',
      'docs.sp.history.reactivated',
      'docs.sp.history.registry',
    ]) {
      expect(typeof leaf(es, key), key).toBe('string');
      expect(typeof leaf(en, key), key).toBe('string');
    }
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

  it('quitar a un firmante dice a quién, el turno, el formulario y el corte, y ofrece su copia', () => {
    const reading = traceReadingOf(
      event('admin.signer_removed', {
        reason: 'se creó con el correo errado',
        identityId: 'i9',
        name: 'Pedro Gil',
        identification: 'CC 10',
        email: 'p@x.co',
        orders: [2],
        turn: { from: 2, to: 3 },
        nobodyPending: false,
        formLeftPending: true,
        access: { links: 2, sessions: 1, handoffs: 0 },
        copied: 1,
      }),
    );
    expect(reading.lines).toEqual([
      {
        key: 'docs.traceUi.reason',
        params: { reason: 'se creó con el correo errado' },
        failed: false,
      },
      { key: 'docs.traceUi.removal.signer', params: { who: 'Pedro Gil · CC 10 · p@x.co' } },
      { key: 'docs.traceUi.turn.moved', params: { from: 2, to: 3 } },
      { key: 'docs.traceUi.removal.form' },
      { key: 'docs.traceUi.access', params: { links: 2, sessions: 1, handoffs: 0 } },
    ]);
    expect(reading.failed).toBe(false);
    expect(reading.copy).toEqual({ identityId: 'i9', name: 'Pedro Gil' });
    expect(reading.cut).toBeUndefined();
  });

  it('un retiro sin corte de acceso ni copia lo marca como falla y ofrece cortar lo que quedó vivo', () => {
    const reading = traceReadingOf(
      event('admin.signer_removed', { identityId: 'i9', nobodyPending: true }),
    );
    expect(keys(reading)).toEqual([
      'docs.traceUi.removal.nobody',
      'docs.traceUi.removal.accessFailed',
    ]);
    expect(reading.failed).toBe(true);
    expect(reading.copy).toBeUndefined();
    expect(reading.cut).toEqual({ identityId: 'i9', name: 'i9' });
    expect(
      traceReadingOf(event('admin.signer_removed', { nobodyPending: true })).cut,
    ).toBeUndefined();
  });

  it('revocar enlaces y corregir el turno dicen lo cortado y el turno nuevo', () => {
    expect(
      traceReadingOf(
        event('admin.signer_links_revoked', { links: 0, sessions: 0, handoffs: 0, documents: 1 }),
      ).lines,
    ).toEqual([{ key: 'docs.traceUi.access', params: { links: 0, sessions: 0, handoffs: 0 } }]);
    expect(
      keys(
        traceReadingOf(
          event('admin.signer_links_revoked', { links: 3, sessions: 0, handoffs: 1, documents: 4 }),
        ),
      ),
    ).toEqual(['docs.traceUi.access', 'docs.traceUi.revoke.documents']);
    expect(traceReadingOf(event('admin.turn_fixed', { from: 1, to: 3, pending: 2 })).lines).toEqual(
      [
        { key: 'docs.traceUi.turn.moved', params: { from: 1, to: 3 } },
        { key: 'docs.traceUi.turn.pending', params: { total: 2 } },
      ],
    );
  });

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

  it('la reactivación dice qué se reactivó, el desbloqueo, los intentos y la respuesta de Registraduría', () => {
    expect(
      traceReadingOf(
        event('admin.validations_reactivated', {
          reason: 'la cámara falló',
          identityId: 'i1',
          scopes: ['biometric', 'registry', 'otra'],
          moved: ['selfie', 'liveness'],
          previousAttempts: 3,
          wasBlocked: true,
          registry: { ok: true, code: 'VIGENTE' },
        }),
      ),
    ).toEqual({
      titleKey: null,
      lines: [
        { key: 'docs.traceUi.reason', params: { reason: 'la cámara falló' }, failed: false },
        {
          key: 'docs.traceUi.react.scopes',
          terms: [{ key: 'docs.react.scope.biometric' }, { key: 'docs.react.scope.registry' }],
        },
        { key: 'docs.traceUi.react.unblocked' },
        { key: 'docs.traceUi.react.attempts', params: { total: 3 } },
        { key: 'docs.traceUi.registry', params: { code: 'VIGENTE' } },
      ],
      failed: false,
    });
    expect(
      keys(
        traceReadingOf(
          event('admin.validations_reactivated', {
            scopes: ['document'],
            previousAttempts: 0,
            wasBlocked: false,
          }),
        ),
      ),
    ).toEqual(['docs.traceUi.react.scopes']);
  });

  it('el cambio de características dice qué se encendió y qué se apagó, con el correo al derecho, y qué adjuntos cambiaron', () => {
    const reading = traceReadingOf(
      event('admin.signer_features_changed', {
        changes: {
          identityValid: { from: false, to: true },
          skipEmail: { from: false, to: true },
          checkDataRegistry: { from: false, to: true },
          reqDocument: { from: true, to: false },
          desconocida: { from: false, to: true },
        },
        removedAttachments: [
          { name: 'Carta', required: false, file: { originalName: 'carta.pdf' } },
          { required: true },
        ],
        optionalAttachments: ['RUT'],
        registry: { ok: true, code: 'VIGENTE' },
      }),
    );
    expect(reading.lines).toEqual([
      {
        key: 'docs.traceUi.feat.on',
        terms: [{ key: 'docs.feat.identityValid' }, { key: 'docs.feat.checkDataRegistry' }],
      },
      {
        key: 'docs.traceUi.feat.off',
        terms: [{ key: 'docs.feat.skipEmail' }, { key: 'docs.feat.reqDocument' }],
      },
      {
        key: 'docs.traceUi.feat.removed',
        terms: [{ key: 'docs.traceUi.name', params: { name: 'Carta' } }],
      },
      {
        key: 'docs.traceUi.feat.optional',
        terms: [{ key: 'docs.traceUi.name', params: { name: 'RUT' } }],
      },
      { key: 'docs.traceUi.registry', params: { code: 'VIGENTE' } },
    ]);
    expect(reading.failed).toBe(false);
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
      event('admin.validations_reactivated', {
        scopes: [...REACTIVATION_SCOPES],
        wasBlocked: true,
        previousAttempts: 2,
        registry: { code: 'VIGENTE' },
      }),
      ...[true, false].map((to) =>
        event('admin.signer_features_changed', {
          changes: Object.fromEntries(
            [...VALIDATION_FEATURES, ...IDENTITY_FEATURES].map((feature) => [
              feature,
              { from: !to, to },
            ]),
          ),
          removedAttachments: [{ name: 'Carta' }],
          optionalAttachments: ['RUT'],
          registry: { code: 'VIGENTE' },
        }),
      ),
      event('admin.signer_removed', {
        identityId: 'i9',
        name: 'Pedro Gil',
        turn: { from: 2, to: 3 },
        nobodyPending: true,
        formLeftPending: true,
        access: { links: 1, sessions: 0, handoffs: 0 },
        copied: 1,
      }),
      event('admin.signer_removed', { identityId: 'i9' }),
      event('admin.signer_links_revoked', { links: 1, sessions: 1, handoffs: 0, documents: 3 }),
      event('admin.turn_fixed', { from: 1, to: 2, pending: 1 }),
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

describe('Documentos: quitar firmante, revocar enlaces y corregir el turno', () => {
  const turn = (order: number, over: Partial<DocumentTurn> = {}): DocumentTurn => ({
    order,
    onHold: false,
    pending: 1,
    ...over,
  });

  const evidence = { kind: 'selfie' as const, legacy: false };

  const stamp = (iso: string) => `[${iso.slice(0, 10)}]`;

  const now = new Date('2026-11-06T12:00:00.000Z');

  const placeholders = (text: unknown): string[] =>
    typeof text === 'string'
      ? [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] ?? '')
      : [];

  it('un turno queda vacío solo si estaba entre los turnos de los demás y nadie más lo tenía', () => {
    const a = signer('a', 1, true);
    const b = signer('b', 2, false);
    const c = signer('c', 3, false);
    const doc = detailOf(1, 0, turn(2), [a, b, c]);
    expect(emptiedOrdersOf(doc, b)).toEqual([2]);
    expect(emptiedOrdersOf(doc, a)).toEqual([]);
    expect(emptiedOrdersOf(doc, c)).toEqual([]);
    expect(emptiedOrdersOf(detailOf(1, 0, turn(2), [a, b, signer('d', 2, false), c]), b)).toEqual(
      [],
    );
    expect(emptiedOrdersOf(detailOf(1, 0, turn(1), [b]), b)).toEqual([]);
    expect(
      emptiedOrdersOf(
        detailOf(1, 0, turn(1), [a, b, signer('b', 4, false), signer('e', 5, false)]),
        b,
      ),
    ).toEqual([2, 4]);
  });

  it('el resumen dice a dónde pasa el turno, si se queda o si no queda nadie, y el corte', () => {
    const doc = detailOf(1, 0, turn(2), [signer('a', 1, true), signer('b', 2, false)]);
    expect(removalSummaryOf(doc, signer('b', 2, false))).toEqual([]);
    expect(
      removalSummaryOf(
        doc,
        signer('b', 2, false, { removal: { turn: { from: 2, to: 3 }, nobodyPending: false } }),
      ),
    ).toEqual([
      { key: 'docs.remove.turnMoves', params: { from: 2, to: 3 } },
      { key: 'docs.remove.access' },
    ]);
    expect(
      removalSummaryOf(doc, signer('b', 2, false, { removal: { nobodyPending: true } })),
    ).toEqual([{ key: 'docs.remove.nobodyPending' }, { key: 'docs.remove.access' }]);
    expect(
      removalSummaryOf(doc, signer('c', 3, false, { removal: { nobodyPending: false } })),
    ).toEqual([
      { key: 'docs.remove.turnStays', params: { order: 2 } },
      { key: 'docs.remove.access' },
    ]);
  });

  it('quitar avisa la integración, los adjuntos del PDF, lo cobrado, el formulario, la evidencia y el hueco', () => {
    const plain = signer('b', 2, false, { removal: { nobodyPending: false } });
    const web = detailOf(1, 0, turn(2), [signer('a', 1, true), plain, signer('c', 3, false)]);
    expect(removalWarningsOf({ ...web, signers: [signer('a', 1, true), plain] }, plain)).toEqual(
      [],
    );
    const loaded = signer('b', 2, false, {
      removal: { nobodyPending: false, formLeftPending: true },
      attachments: [
        {
          index: 0,
          name: 'RUT',
          info: '',
          required: true,
          includeInDocument: true,
          provided: true,
        },
        {
          index: 1,
          name: 'Carta',
          info: '',
          required: false,
          includeInDocument: true,
          provided: false,
        },
      ],
      attempts: {
        ...platformSigner().attempts,
        credits: { biometric: true, identity: false },
      },
    });
    expect(
      removalWarningsOf(
        { ...web, kind: 'API', signers: [signer('a', 1, true), loaded, signer('c', 3, false)] },
        loaded,
      ),
    ).toEqual([
      { key: 'docs.remove.warn.integration' },
      { key: 'docs.remove.warn.attachments', params: { names: 'RUT' } },
      { key: 'docs.remove.warn.charged' },
      { key: 'docs.remove.warn.form' },
      { key: 'docs.remove.warn.evidence' },
      { key: 'docs.remove.warn.gap', params: { orders: '2' } },
    ]);
    const filed = signer('b', 2, false, { files: [evidence] });
    expect(removalWarningsOf({ ...web, kind: 'BRIDGE', signers: [filed] }, filed)).toEqual([
      { key: 'docs.remove.warn.integration' },
      { key: 'docs.remove.warn.evidence' },
    ]);
    const historic = signer('b', 2, false, {
      history: [{ index: 0, files: ['selfie'] }],
      attempts: { ...platformSigner().attempts, credits: { biometric: false, identity: true } },
    });
    expect(removalWarningsOf({ ...web, signers: [historic] }, historic)).toEqual([
      { key: 'docs.remove.warn.charged' },
      { key: 'docs.remove.warn.evidence' },
    ]);
  });

  it('lo cobrado cuenta la consulta al registro y las respuestas del proveedor, en todas sus entradas', () => {
    const plain = signer('b', 2, false);
    const registry = signer('b', 4, false, {
      checks: { providerResponses: [], registry: { code: 'VIGENTE', checkedAt: '2026-11-01' } },
    });
    const provider = signer('b', 2, false, {
      checks: { providerResponses: [{ type: 'liveness', data: {} }] },
    });
    const checked = signer('b', 2, false, {
      checks: { providerResponses: [], faceCompare: { passed: true, at: '2026-11-01' } },
    });
    const twice = (one: PlatformSigner, two: PlatformSigner) =>
      removalWarningsOf(detailOf(1, 0, turn(2), [signer('a', 1, true), one, two]), one);
    expect(twice(plain, registry)).toEqual([{ key: 'docs.remove.warn.charged' }]);
    expect(twice(provider, plain)).toEqual([{ key: 'docs.remove.warn.charged' }]);
    expect(twice(plain, checked)).toEqual([{ key: 'docs.remove.warn.charged' }]);
    expect(twice(plain, signer('b', 4, false))).toEqual([]);
    const rut = {
      index: 0,
      name: 'RUT',
      info: '',
      required: true,
      includeInDocument: true,
      provided: true,
    };
    expect(
      twice(
        signer('b', 2, false, { attachments: [rut] }),
        signer('b', 4, false, { attachments: [rut, { ...rut, index: 1, name: 'Carta' }] }),
      ),
    ).toEqual([
      { key: 'docs.remove.warn.attachments', params: { names: 'RUT, Carta' } },
      { key: 'docs.remove.warn.evidence' },
    ]);
  });

  it('sin avisar dice quién no tiene invitación y a quién le empiezan los recordatorios', () => {
    const nuevo = signer('n', 2, false, { name: 'Nora' });
    const viejo = signer('v', 2, false, {
      name: 'Vera',
      email: 'vera@x.co',
      notices: { remindersSent: 0, notifiedAt: '2026-11-01T10:00:00.000Z' },
    });
    const doc = detailOf(1, 0, turn(2), [signer('a', 1, true), nuevo, viejo]);
    expect(noticeWarningsOf(doc, [], false, now, stamp)).toEqual([]);
    expect(noticeWarningsOf(doc, ['nadie'], true, now, stamp)).toEqual([]);
    expect(noticeWarningsOf(doc, ['n', 'v', 'n'], false, now, stamp)).toEqual([
      { key: 'docs.turnNotice.warn.uninvited', params: { names: 'Nora' } },
      { key: 'docs.turnNotice.warn.reminders', params: { names: 'Vera' } },
    ]);
    expect(noticeWarningsOf(doc, ['n'], false, now, stamp)).toEqual([
      { key: 'docs.turnNotice.warn.uninvited', params: { names: 'Nora' } },
    ]);
    expect(noticeWarningsOf(doc, ['n'], true, now, stamp)).toEqual([]);
  });

  it('sin avisar dice por qué a alguien no le salen recordatorios: plazo, bloqueo, sin correo o tope', () => {
    const invited = { remindersSent: 0, notifiedAt: '2026-11-01T10:00:00.000Z' };
    const vera = signer('v', 2, false, { name: 'Vera', email: 'v@x.co', notices: invited });
    const berta = signer('b', 2, false, {
      name: 'Berta',
      email: 'b@x.co',
      blocked: true,
      notices: invited,
    });
    const sara = signer('s', 2, false, { name: 'Sara', notices: invited });
    const omar = signer('o', 2, false, {
      name: 'Omar',
      email: 'o@x.co',
      requirements: { ...platformSigner().requirements, skipEmail: true },
      notices: invited,
    });
    const tina = signer('t', 2, false, {
      name: 'Tina',
      email: 't@x.co',
      notices: { ...invited, remindersSent: 3 },
    });
    const nora = signer('n', 2, false, { name: 'Nora' });
    const doc: PlatformDocumentDetail = {
      ...detailOf(1, 0, turn(2), [signer('a', 1, true), vera, berta, sara, omar, tina, nora]),
      signing: { reminders: { everyHours: 24, max: 3 } },
    };
    expect(noticeWarningsOf(doc, ['v', 'b', 's', 'o', 't', 'n'], false, now, stamp)).toEqual([
      { key: 'docs.turnNotice.warn.uninvited', params: { names: 'Nora' } },
      { key: 'docs.turnNotice.warn.noReminders.blocked', params: { names: 'Berta' } },
      { key: 'docs.turnNotice.warn.noReminders.noEmail', params: { names: 'Sara, Omar' } },
      { key: 'docs.turnNotice.warn.noReminders.cap', params: { names: 'Tina', max: 3 } },
      { key: 'docs.turnNotice.warn.reminders', params: { names: 'Vera' } },
    ]);
    expect(noticeWarningsOf({ ...doc, signing: undefined }, ['t'], false, now, stamp)).toEqual([
      { key: 'docs.turnNotice.warn.reminders', params: { names: 'Tina' } },
    ]);
    expect(
      noticeWarningsOf(
        { ...doc, signing: undefined, reminderBaseline: { everyHours: 48, max: 3 } },
        ['t', 'v'],
        false,
        now,
        stamp,
      ),
    ).toEqual([
      { key: 'docs.turnNotice.warn.noReminders.cap', params: { names: 'Tina', max: 3 } },
      { key: 'docs.turnNotice.warn.reminders', params: { names: 'Vera' } },
    ]);
    expect(
      noticeWarningsOf(
        { ...doc, signing: { deadline: '2026-11-05T23:59:00.000Z' } },
        ['v', 'b', 'n'],
        false,
        now,
        stamp,
      ),
    ).toEqual([
      { key: 'docs.turnNotice.warn.uninvited', params: { names: 'Nora' } },
      { key: 'docs.turnNotice.warn.noReminders.deadline', params: { date: '[2026-11-05]' } },
    ]);
  });

  it('al avisar dice la firma automática, el bloqueo, la invitación repetida, la integración y el plazo vencido', () => {
    const auto = signer('f', 2, false, { name: 'Fabio', autoSign: true });
    const blocked = signer('b', 2, false, { name: 'Berta', blocked: true });
    const again = signer('g', 2, false, {
      name: 'Gina',
      notices: { remindersSent: 2, notifiedAt: '2026-11-01T10:00:00.000Z' },
    });
    const doc: PlatformDocumentDetail = {
      ...detailOf(1, 0, turn(2), [auto, blocked, again]),
      kind: 'BRIDGE',
      signing: { deadline: '2026-11-05T23:59:00.000Z' },
    };
    expect(noticeWarningsOf(doc, ['f', 'b', 'g'], true, now, stamp)).toEqual([
      { key: 'docs.turnNotice.warn.autoSign', params: { names: 'Fabio' } },
      { key: 'docs.turnNotice.warn.blocked', params: { names: 'Berta' } },
      { key: 'docs.turnNotice.warn.again', params: { names: 'Gina' } },
      { key: 'docs.turnNotice.warn.integration' },
      { key: 'docs.turnNotice.warn.deadline', params: { date: '[2026-11-05]' } },
    ]);
    expect(
      noticeWarningsOf(
        { ...doc, kind: 'WEB', signing: { deadline: '2026-11-30T23:59:00.000Z' } },
        ['f', 'b'],
        true,
        now,
        stamp,
      ),
    ).toEqual([
      { key: 'docs.turnNotice.warn.autoSign', params: { names: 'Fabio' } },
      { key: 'docs.turnNotice.warn.blocked', params: { names: 'Berta' } },
    ]);
  });

  it('revocar avisa el bloque o el flujo, y el recordatorio que le daría un enlace nuevo', () => {
    const invited = signer('b', 2, false, {
      notices: { remindersSent: 0, notifiedAt: '2026-11-01T10:00:00.000Z' },
    });
    const doc = detailOf(1, 0, turn(2), [signer('a', 1, true), invited]);
    expect(revokeWarningsOf(doc, signer('b', 2, false))).toEqual([]);
    expect(revokeWarningsOf(doc, invited)).toEqual([{ key: 'docs.revoke.warn.reminder' }]);
    expect(
      revokeWarningsOf(
        { ...doc, block: { id: 'k1', documents: 3 }, flow: { flowId: 'f1' } },
        invited,
      ),
    ).toEqual([{ key: 'docs.revoke.warn.block' }, { key: 'docs.revoke.warn.reminder' }]);
    expect(revokeWarningsOf({ ...doc, flow: { flowId: 'f1' } }, signer('b', 2, false))).toEqual([
      { key: 'docs.revoke.warn.flow' },
    ]);
    expect(revokeWarningsOf({ ...doc, turn: turn(2, { onHold: true }) }, invited)).toEqual([]);
    expect(revokeWarningsOf({ ...doc, turn: turn(3) }, invited)).toEqual([]);
    expect(revokeWarningsOf(detailOf(3, 0, turn(2), doc.signers), invited)).toEqual([]);
    expect(revokeWarningsOf(detailOf(1, 4, turn(2), doc.signers), invited)).toEqual([]);
  });

  it('cortar a quien ya salió solo avisa el bloque o el flujo', () => {
    const doc = detailOf(1, 0, turn(2), [signer('a', 1, true)]);
    expect(setWarningsOf(doc)).toEqual([]);
    expect(setWarningsOf({ ...doc, block: { id: 'k1', documents: 3 } })).toEqual([
      { key: 'docs.revoke.warn.block' },
    ]);
    expect(setWarningsOf({ ...doc, flow: { flowId: 'f1' } })).toEqual([
      { key: 'docs.revoke.warn.flow' },
    ]);
  });

  it('lo cortado se dice con el conjunto solo si fue más de un documento, y nada si no había', () => {
    expect(accessPhraseOf({ links: 0, sessions: 0, handoffs: 0 })).toEqual({
      key: 'docs.revoke.none',
    });
    expect(accessPhraseOf({ links: 0, sessions: 0, handoffs: 0 }, 4)).toEqual({
      key: 'docs.revoke.none',
    });
    expect(accessPhraseOf({ links: 2, sessions: 1, handoffs: 0 })).toEqual({
      key: 'docs.revoke.done',
      params: { links: 2, sessions: 1, handoffs: 0, documents: 1 },
    });
    expect(accessPhraseOf({ links: 0, sessions: 0, handoffs: 1 }, 3)).toEqual({
      key: 'docs.revoke.doneSet',
      params: { links: 0, sessions: 0, handoffs: 1, documents: 3 },
    });
  });

  it('el resultado de quitar dice a dónde pasó el turno o que ya se puede finalizar', () => {
    const base = { identityId: 'b', orders: [2], nobodyPending: false };
    expect(removalDoneOf('Luis', { ...base, turn: { from: 2, to: 3 } })).toEqual({
      key: 'docs.remove.doneTurn',
      params: { name: 'Luis', to: 3 },
    });
    expect(removalDoneOf('Luis', { ...base, nobodyPending: true })).toEqual({
      key: 'docs.remove.doneNobody',
      params: { name: 'Luis' },
    });
    expect(removalDoneOf('Luis', base)).toEqual({
      key: 'docs.remove.done',
      params: { name: 'Luis' },
    });
  });

  it('la invitación dice lo que salió, y si falló, la causa que se conoce o cómo invitar después', () => {
    const sent = { invited: 2, mailed: 2, whatsapp: 1, autoSigned: 0 };
    expect(noticeReportOf(sent)).toEqual({
      failed: false,
      counts: [{ key: 'docs.turnNotice.sent', params: { invited: 2, mailed: 2, whatsapp: 1 } }],
      problem: [],
    });
    expect(noticeReportOf({ ...sent, autoSigned: 1 }).counts).toEqual([
      { key: 'docs.turnNotice.sent', params: { invited: 2, mailed: 2, whatsapp: 1 } },
      { key: 'docs.turnNotice.autoSigned', params: { count: 1 } },
    ]);
    expect(noticeReportOf({ invited: 0, mailed: 0, whatsapp: 0, autoSigned: 0 })).toEqual({
      failed: false,
      counts: [{ key: 'docs.turnNotice.none' }],
      problem: [],
    });
    expect(noticeReportOf({ ...sent, error: { reason: 'x' } })).toEqual({
      failed: true,
      counts: [{ key: 'docs.turnNotice.sent', params: { invited: 2, mailed: 2, whatsapp: 1 } }],
      problem: [{ key: 'docs.turnNotice.partial' }, { key: 'docs.turnNotice.later' }],
    });
    const failed = (code?: string) =>
      noticeReportOf({
        invited: 0,
        mailed: 0,
        whatsapp: 0,
        autoSigned: 0,
        error: { reason: 'x', ...(code ? { code } : {}) },
      });
    expect(failed('VALIDACIONES_AGOTADAS')).toEqual({
      failed: true,
      counts: [],
      problem: [{ key: 'docs.turnNotice.failed' }, { key: 'docs.turnNotice.noCredits' }],
    });
    expect(failed('DOCUMENTO_NO_PENDIENTE').problem[1]).toEqual({
      key: 'docs.error.DOCUMENTO_NO_PENDIENTE',
    });
    expect(failed('ALGO_NUEVO').problem[1]).toEqual({ key: 'docs.turnNotice.later' });
    expect(failed().problem[1]).toEqual({ key: 'docs.turnNotice.later' });
  });

  it('el motivo pide al menos tres letras sin contar los espacios', () => {
    expect(REASON_MIN).toBe(3);
    expect(reasonReady('')).toBe(false);
    expect(reasonReady('  ab  ')).toBe(false);
    expect(reasonReady(' abc ')).toBe(true);
  });

  it('los pendientes de un turno son los que no han firmado, sin repetir', () => {
    const doc = detailOf(1, 0, turn(2), [
      signer('a', 2, false, { name: 'Ana' }),
      signer('b', 2, true, { name: 'Beto' }),
      signer('c', 2, false, { name: 'Ciro' }),
      signer('a', 3, false, { name: 'Ana' }),
    ]);
    expect(pendingNamesAt(doc, 2)).toBe('Ana, Ciro');
    expect(pendingNamesAt(doc, 3)).toBe('Ana');
    expect(pendingNamesAt(doc, 9)).toBe('');
  });

  it('cada frase existe en los dos idiomas y recibe todo lo que su texto pide', () => {
    const everyone = [
      signer('f', 2, false, { autoSign: true, blocked: true }),
      signer('g', 2, false, { notices: { remindersSent: 0, notifiedAt: '2026-11-01T10:00:00Z' } }),
    ];
    const doc: PlatformDocumentDetail = {
      ...detailOf(1, 0, turn(2), [signer('a', 1, true), ...everyone, signer('z', 3, false)]),
      kind: 'API',
      signing: { deadline: '2026-11-01T00:00:00.000Z' },
      block: { id: 'k1', documents: 2 },
    };
    const loaded = signer('g', 2, false, {
      removal: { nobodyPending: false, formLeftPending: true, turn: { from: 2, to: 3 } },
      attachments: [
        {
          index: 0,
          name: 'RUT',
          info: '',
          required: true,
          includeInDocument: true,
          provided: true,
        },
      ],
      attempts: { ...platformSigner().attempts, credits: { biometric: true, identity: true } },
      notices: { remindersSent: 0, notifiedAt: '2026-11-01T10:00:00Z' },
    });
    const base = { identityId: 'g', orders: [2], nobodyPending: false };
    const noticeError = { invited: 0, mailed: 0, whatsapp: 0, autoSigned: 0 };
    const phrases = [
      ...removalSummaryOf(doc, loaded),
      ...removalSummaryOf(doc, signer('g', 2, false, { removal: { nobodyPending: true } })),
      ...removalSummaryOf(doc, signer('g', 2, false, { removal: { nobodyPending: false } })),
      ...removalWarningsOf(
        { ...doc, signers: [signer('a', 1, true), loaded, signer('z', 3, false)] },
        loaded,
      ),
      ...noticeWarningsOf(doc, ['f', 'g'], true, now, stamp),
      ...noticeWarningsOf(
        { ...doc, signers: [signer('n', 2, false), loaded] },
        ['n', 'g'],
        false,
        now,
        stamp,
      ),
      ...noticeWarningsOf(
        {
          ...doc,
          signing: { reminders: { everyHours: 24, max: 1 } },
          signers: [
            signer('b', 2, false, { blocked: true, notices: loaded.notices }),
            signer('s', 2, false, { notices: loaded.notices }),
            signer('t', 2, false, {
              email: 't@x.co',
              notices: { ...loaded.notices, remindersSent: 1 },
            }),
            signer('v', 2, false, { email: 'v@x.co', notices: loaded.notices }),
          ],
        },
        ['b', 's', 't', 'v'],
        false,
        now,
        stamp,
      ),
      ...setWarningsOf(doc),
      ...revokeWarningsOf(doc, loaded),
      ...revokeWarningsOf({ ...doc, block: undefined, flow: { flowId: 'f1' } }, loaded),
      accessPhraseOf({ links: 0, sessions: 0, handoffs: 0 }),
      accessPhraseOf({ links: 1, sessions: 0, handoffs: 0 }),
      accessPhraseOf({ links: 1, sessions: 0, handoffs: 0 }, 2),
      removalDoneOf('Luis', { ...base, turn: { from: 2, to: 3 } }),
      removalDoneOf('Luis', { ...base, nobodyPending: true }),
      removalDoneOf('Luis', base),
      ...[
        noticeReportOf({ invited: 1, mailed: 1, whatsapp: 1, autoSigned: 1 }),
        noticeReportOf(noticeError),
        noticeReportOf({ ...noticeError, error: { reason: 'x', code: 'VALIDACIONES_AGOTADAS' } }),
        noticeReportOf({ ...noticeError, error: { reason: 'x' } }),
        noticeReportOf({
          invited: 1,
          mailed: 1,
          whatsapp: 0,
          autoSigned: 0,
          error: { reason: 'x' },
        }),
      ].flatMap((report) => [...report.counts, ...report.problem]),
    ];
    const fixed = [
      { key: 'docs.remove.title' },
      { key: 'docs.remove.lead', params: { name: 'Luis' } },
      { key: 'docs.remove.confirm' },
      { key: 'docs.remove.accessFailed.title' },
      { key: 'docs.remove.accessFailed.message', params: { name: 'Luis' } },
      { key: 'docs.remove.accessFailed.retry' },
      { key: 'docs.turnNotice.label' },
      { key: 'docs.turnNotice.hint', params: { names: 'Luis' } },
      { key: 'docs.turnFix.title' },
      { key: 'docs.turnFix.lead', params: { from: 1, to: 2 } },
      { key: 'docs.turnFix.pending', params: { to: 2, names: 'Luis' } },
      { key: 'docs.turnFix.confirm' },
      { key: 'docs.turnFix.done', params: { to: 2 } },
      { key: 'docs.revoke.title' },
      { key: 'docs.revoke.message' },
      { key: 'docs.revoke.removedMessage', params: { name: 'Luis' } },
      { key: 'docs.revoke.live', params: { live: 1 } },
      { key: 'docs.revoke.confirm' },
      { key: 'docs.signer.remove' },
      { key: 'docs.signer.revokeLinks' },
      { key: 'docs.act.fixTurn.label' },
      { key: 'docs.sp.link.live' },
      { key: 'docs.act.reasonMin' },
      { key: 'docs.act.waiting' },
      { key: 'dialog.reasonMin', params: { min: 3 } },
      { key: 'docs.traceUi.removal.copy' },
    ];
    const keys = new Set([...phrases, ...fixed].map((item) => item.key));
    for (const key of [
      'docs.remove.warn.integration',
      'docs.remove.warn.attachments',
      'docs.remove.warn.charged',
      'docs.remove.warn.form',
      'docs.remove.warn.evidence',
      'docs.remove.warn.gap',
      'docs.turnNotice.warn.autoSign',
      'docs.turnNotice.warn.blocked',
      'docs.turnNotice.warn.again',
      'docs.turnNotice.warn.integration',
      'docs.turnNotice.warn.deadline',
      'docs.turnNotice.warn.uninvited',
      'docs.turnNotice.warn.reminders',
      'docs.turnNotice.warn.noReminders.deadline',
      'docs.turnNotice.warn.noReminders.blocked',
      'docs.turnNotice.warn.noReminders.noEmail',
      'docs.turnNotice.warn.noReminders.cap',
      'docs.revoke.warn.block',
      'docs.revoke.warn.flow',
      'docs.revoke.warn.reminder',
      'docs.revoke.none',
      'docs.revoke.done',
      'docs.revoke.doneSet',
      'docs.remove.done',
      'docs.remove.doneTurn',
      'docs.remove.doneNobody',
      'docs.turnNotice.sent',
      'docs.turnNotice.autoSigned',
      'docs.turnNotice.none',
      'docs.turnNotice.failed',
      'docs.turnNotice.partial',
      'docs.turnNotice.noCredits',
      'docs.turnNotice.later',
    ]) {
      expect(keys.has(key), key).toBe(true);
    }
    for (const item of [...phrases, ...fixed]) {
      const params = Object.keys('params' in item ? (item.params ?? {}) : {});
      for (const catalog of [es, en]) {
        const text = leaf(catalog, item.key);
        expect(typeof text, item.key).toBe('string');
        for (const name of placeholders(text))
          expect(params, `${item.key} → ${name}`).toContain(name);
      }
    }
  });
});
