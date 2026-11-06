import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { AuthStore } from '../../../core/auth/auth.store';
import { API_BASE_URL } from '../../../core/config/api.tokens';
import { sectionPath } from '../../../core/layout/console-nav';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import type { PlatformDocumentDetail, PlatformSigner, TraceEvent } from '../data/documents.models';
import { platformSigner } from '../documents-test-kit';
import { DocumentDetailComponent } from './document-detail.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const detail = (over: Partial<PlatformDocumentDetail> = {}): PlatformDocumentDetail => ({
  id: 'd1',
  name: 'Contrato de arriendo',
  code: 'CA-0001',
  kind: 'WEB',
  portal: 'docublock',
  organization: { id: 'o1', businessName: 'Notaría 14' },
  owner: { id: 'u1', names: 'Marta Vidal' },
  status: { progress: 2, state: 0, label: 'parcialmente firmado' },
  signedCount: 2,
  signerCount: 2,
  anchored: false,
  createdAt: '2026-10-20T10:00:00.000Z',
  signers: [
    platformSigner({ identityId: 'i1', name: 'Ana Ruiz', email: 'ana@x.co', checked: true }),
    platformSigner({
      identityId: 'i2',
      name: 'Luis Mora',
      order: 2,
      checked: true,
      signingAttempts: 3,
      blocked: true,
      checks: {
        liveness: { sessionId: 's', passed: true, confidence: 98 },
        providerResponses: [],
      },
    }),
  ],
  versions: [
    {
      id: 'v1',
      index: 1,
      checksum: 'a'.repeat(64),
      signatureProgress: '1',
      createdAt: '2026-10-20T10:00:00.000Z',
    },
    {
      id: 'v2',
      index: 2,
      checksum: 'b'.repeat(64),
      signatureProgress: '2',
      createdAt: '2026-10-21T10:00:00.000Z',
    },
  ],
  turn: { order: 2, onHold: false, pending: 0 },
  fields: [],
  attachments: [],
  principalFolder: false,
  sourceTemplates: [],
  ...over,
});

const stubObjectUrls = () => {
  const urls = URL as unknown as Record<string, unknown>;
  const before = { create: urls['createObjectURL'], revoke: urls['revokeObjectURL'] };
  urls['createObjectURL'] = vi.fn(() => 'blob:prueba');
  urls['revokeObjectURL'] = vi.fn();
  return () => {
    urls['createObjectURL'] = before.create;
    urls['revokeObjectURL'] = before.revoke;
  };
};

const events: TraceEvent[] = [
  {
    type: 'admin.document_finalized',
    timestamp: '2026-10-22T10:00:00.000Z',
    actor: { type: 'system' },
    details: { reason: 'pedido' },
  },
  {
    type: 'algo.nuevo',
    timestamp: '2026-10-21T10:00:00.000Z',
    actor: { type: 'signer', name: 'Ana Ruiz', ip: '10.0.0.1' },
  },
];

describe('Operación › Documentos › ficha', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const conPermisos = (permisos: string[]) =>
    TestBed.inject(AuthStore).setProfile({
      user: {
        id: 'u1',
        names: 'Marta',
        surNames: 'Vidal',
        email: 'marta@docublock.co',
        identification: '',
        imageProfile: null,
      },
      platformStaff: true,
      platformPermissions: permisos,
    });

  const montar = async (
    body: PlatformDocumentDetail | null = detail(),
    trace: TraceEvent[] = events,
  ) => {
    const fixture = TestBed.createComponent(DocumentDetailComponent);
    fixture.componentRef.setInput('id', 'd1');
    fixture.detectChanges();
    const req = http.expectOne('/platform/documents/d1');
    if (body) req.flush(body);
    else req.flush({ code: 'DOCUMENTO_NO_ENCONTRADO' }, { status: 404, statusText: 'Not Found' });
    http
      .expectOne('/platform/documents/d1/traceability')
      .flush({ documentId: 'd1', total: trace.length, events: trace });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-section-loader')).toBeNull();
    });
    return { fixture, host };
  };

  const tab = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('db-underline-tabs .tab')].find((t) =>
      t.textContent?.includes(label),
    )!;

  const boton = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(label),
    )!;

  it('cabecera, resumen y pestañas con conteos; solo lectura no ofrece acciones', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Contrato de arriendo');
    expect(host.querySelector('.rec__card')?.textContent).toContain('En progreso');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('CA-0001');
    expect(host.querySelector('.sm__dl')?.textContent).toContain('Marta Vidal');
    expect(host.querySelector('db-underline-tabs')?.textContent).toContain('Firmantes2');
    const acciones = host.querySelector('.dd__actions')?.textContent ?? '';
    expect(acciones).toContain('Datos completos');
    expect(acciones).toContain('Expediente');
    expect(acciones).not.toContain('Acciones del documento');
    expect(host.textContent).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
  });

  it('el resumen dice origen, plantilla, agrupación, turno del core, plazo, campos, integración y adjuntos', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar(
      detail({
        kind: 'API',
        portal: 'arkdia',
        template: { id: 't1', name: 'Arriendo', code: 'AR' },
        directory: { id: 'dir', name: 'Comercial' },
        folder: { id: 'd0', name: 'Contrato', code: 'CA-0000' },
        block: { id: 'b1', name: 'Paquete', signatureMode: 'independent', documents: 3 },
        flow: { flowId: 'f1', flowName: 'Vinculación', processId: 'p1', processName: 'Proceso 12' },
        turn: { order: 1, onHold: false, pending: 0 },
        signing: { deadline: '2026-12-31T00:00:00.000Z', reminders: { everyHours: 24, max: 3 } },
        quotaConsumedAt: '2026-10-22T10:00:00.000Z',
        fields: [{ name: 'ciudad', value: 'Cali' }],
        relatedInfo: { externalRef: 'PO-1' },
        attachments: [
          { index: 0, name: 'Anexo técnico', merge: true, available: true },
          { index: 1, name: 'Foto', merge: false, available: false },
        ],
      }),
    );
    const text = host.querySelector('dba-document-summary')?.textContent ?? '';
    for (const part of [
      'API',
      'Arkdia',
      'Arriendo · AR',
      'Comercial',
      'Contrato · CA-0000',
      'Paquete',
      'Firma por documento · 3 documentos',
      'Vinculación',
      'Proceso: Proceso 12',
      'Nadie por firmar en este turno',
      'Cada 24 h · hasta 3',
      'Sin tope',
      'ciudad',
      'Cali',
      'externalRef',
      'PO-1',
      'Anexo técnico',
      'Se une al PDF',
      'Sin archivo',
    ]) {
      expect(text, part).toContain(part);
    }
    expect(
      host.querySelector('dba-document-summary a[href="/operacion/documentos/d0"]'),
    ).not.toBeNull();
    expect(text).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
  });

  it('sin política de firma ni datos dice qué aplica en vez de quedar en blanco', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar();
    const text = host.querySelector('dba-document-summary')?.textContent ?? '';
    for (const part of [
      'Web',
      'Docublock',
      'Sin plazo',
      'Los de la plataforma',
      'Sin tope',
      'Sin cobro registrado',
      'El documento no tiene campos llenos.',
      'Sin datos de la integración.',
      'El documento no tiene adjuntos.',
    ]) {
      expect(text, part).toContain(part);
    }
  });

  it('«Datos completos» muestra lo guardado sin secretos y dice qué se ocultó', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar();
    boton(host, 'Datos completos').click();
    fixture.detectChanges();
    http.expectOne('/platform/documents/d1/raw').flush({
      id: 'd1',
      data: { code: 'CA-0001', relatedInfo: { externalRef: 'R-1' } },
      hidden: [
        { path: 'token', reason: 'secret' },
        { path: 'pattern', reason: 'html' },
      ],
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.raw__code')?.textContent).toContain('"externalRef": "R-1"');
    });
    const ocultos = host.querySelector('.raw__hidden')?.textContent ?? '';
    expect(ocultos).toContain('Secretos');
    expect(ocultos).toContain('token');
    expect(ocultos).toContain('HTML de la plantilla');
    expect(host.textContent).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
  });

  it('el certificado se abre en otra pestaña, y un archivo perdido dice por qué', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(
      detail({ certificate: { sha256: 'c'.repeat(64), issuedAt: '2026-10-22T10:00:00.000Z' } }),
    );
    const restore = stubObjectUrls();
    const pestana = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window);
    boton(host, 'Ver certificado').click();
    http.expectOne('/platform/documents/d1/certificate/file').flush(new Blob(['%PDF']));
    await vi.waitFor(() => expect(pestana.location.href).toBe('blob:prueba'));
    const mal = vi.spyOn(TestBed.inject(NotificationService), 'error');
    fixture.detectChanges();
    boton(host, 'Ver certificado').click();
    http
      .expectOne('/platform/documents/d1/certificate/file')
      .flush(new Blob([JSON.stringify({ code: 'ARCHIVO_NO_DISPONIBLE' })]), {
        status: 404,
        statusText: 'Not Found',
      });
    await vi.waitFor(() =>
      expect(mal).toHaveBeenCalledWith('El archivo no está en el almacenamiento.'),
    );
    expect(pestana.close).toHaveBeenCalled();
    restore();
  });

  it('el expediente se descarga con el nombre que manda el core', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar();
    const restore = stubObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const agregado = vi.spyOn(document.body, 'appendChild');
    boton(host, 'Expediente').click();
    http.expectOne('/platform/documents/d1/bundle').flush(new Blob(['zip']), {
      headers: { 'content-disposition': 'attachment; filename="expediente-CA-0001.zip"' },
    });
    await vi.waitFor(() => {
      const enlace = agregado.mock.calls
        .map(([node]) => node)
        .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
      expect(enlace?.download).toBe('expediente-CA-0001.zip');
    });
    restore();
  });

  it('documento inexistente muestra su estado y vuelve a la lista', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar(null);
    expect(host.querySelector('dba-empty-state')?.textContent).toContain('Documento no encontrado');
    expect(host.querySelector('a[dba-button]')?.getAttribute('href')).toBe('/operacion/documentos');
  });

  it('finalizar pide razón, manda la razón y recarga la ficha', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture, host } = await montar();
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: ' faltaba el cierre ' });
    const ok = vi.spyOn(TestBed.inject(NotificationService), 'success');
    (
      fixture.componentInstance as unknown as { runDocument: (k: string) => Promise<void> }
    ).runDocument('finalize');
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0].reason?.required).toBe(true);
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/platform/documents/d1/finalize',
      );
    });
    expect(req.request.body).toEqual({ reason: 'faltaba el cierre' });
    req.flush({});
    await vi.waitFor(() =>
      http
        .expectOne('/platform/documents/d1')
        .flush(detail({ status: { progress: 3, state: 0, label: '' } })),
    );
    http
      .expectOne('/platform/documents/d1/traceability')
      .flush({ documentId: 'd1', total: 0, events: [] });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.rec__card')?.textContent).toContain('Completado');
    });
    expect(ok).toHaveBeenCalledWith('Documento finalizado');
  });

  it('un error conocido del core sale como frase', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture } = await montar();
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'razón larga',
    });
    const mal = vi.spyOn(TestBed.inject(NotificationService), 'error');
    (
      fixture.componentInstance as unknown as { runDocument: (k: string) => Promise<void> }
    ).runDocument('cancel');
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne((r) => r.method === 'POST' && r.url === '/platform/documents/d1/cancel');
    });
    req.flush({ code: 'TRANSICION_INVALIDA' }, { status: 400, statusText: 'Bad Request' });
    await vi.waitFor(() =>
      expect(mal).toHaveBeenCalledWith('El documento no se puede anular en su estado actual.'),
    );
  });

  it('el menú del documento solo ofrece lo que el estado permite', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture } = await montar();
    const items = (fixture.componentInstance as unknown as { menuItems: () => { key: string }[] })
      .menuItems()
      .map((i) => i.key);
    expect(items).toEqual(['finalize', 'cancel']);
  });

  const abrirPanel = (fixture: { detectChanges: () => void }, host: HTMLElement) => {
    tab(host, 'Firmantes').click();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.sg__toggle')!.click();
    fixture.detectChanges();
    return host.querySelector<HTMLElement>('dba-signer-panel')!;
  };

  const completo = (over: Partial<PlatformSigner> = {}): PlatformSigner =>
    platformSigner({
      identityId: 'i2',
      signerId: 's2',
      name: 'Luis Mora',
      email: 'luis@x.co',
      order: 2,
      signingAttempts: 1,
      requirements: {
        identityValid: true,
        biometricValid: true,
        liveness: true,
        checkDataRegistry: true,
        fullIdentity: true,
        reqDocument: true,
        skipEmail: false,
        fillsForms: false,
        photoMode: 'document',
      },
      identity: {
        check: { variant: 'full', verifiedAt: '2026-10-21T10:00:00.000Z', ip: '10.0.0.9' },
        maxAttempts: 3,
      },
      checks: {
        liveness: { passed: true, confidence: 97, threshold: 90, at: '2026-10-21T10:01:00.000Z' },
        faceCompare: { passed: false, score: 61, threshold: 80, at: '2026-10-21T10:02:00.000Z' },
        faceMatch: { passed: true, code: 'OK', fallback: false, at: '2026-10-21T10:03:00.000Z' },
        registry: { ok: true, code: 'VIGENTE', checkedAt: '2026-10-21T10:04:00.000Z' },
        providerResponses: [
          { type: 'faceMatch', date: '2026-10-21T10:03:00.000Z', data: { similitud: 0.93 } },
        ],
      },
      files: [{ kind: 'selfie', legacy: false, mime: 'image/jpeg', size: 2048 }],
      history: [{ index: 0, rejectedAt: '2026-10-21T09:00:00.000Z', files: ['selfie'] }],
      signature: {
        signedAt: '2026-10-21T10:05:00.000Z',
        method: 'otp',
        otpChannels: ['email', 'whatsapp'],
        location: { city: 'Cali', region: 'Valle', country: 'Colombia', provider: 'ipinfo' },
      },
      link: { state: 'active', issued: 2, lastIssuedAt: '2026-10-21T08:00:00.000Z' },
      ...over,
    });

  it('firmantes con estado, panel desplegable y desbloqueo con razón', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture, host } = await montar(
      detail({ signers: [{ ...detail().signers[1], checked: false }] }),
    );
    tab(host, 'Firmantes').click();
    fixture.detectChanges();
    const row = host.querySelector('.sg__row');
    expect(row?.textContent).toContain('Luis Mora');
    expect(row?.textContent).toContain('Bloqueado');
    const panel = abrirPanel(fixture, host);
    expect(panel.textContent).toContain('Liveness');
    expect(panel.textContent).toContain('Aprobada');
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'llamó al soporte' });
    const signer = (
      fixture.componentInstance as unknown as { detail: () => PlatformDocumentDetail }
    ).detail()!.signers[0];
    (
      fixture.componentInstance as unknown as { runSigner: (a: unknown) => Promise<void> }
    ).runSigner({ kind: 'unblock', signer });
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    let req!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      req = http.expectOne(
        (r) => r.method === 'POST' && r.url === '/platform/documents/d1/signers/i2/unblock',
      );
    });
    expect(req.request.body).toEqual({ reason: 'llamó al soporte' });
    req.flush({ unblocked: true });
    await vi.waitFor(() => http.expectOne('/platform/documents/d1').flush(detail()));
    http
      .expectOne('/platform/documents/d1/traceability')
      .flush({ documentId: 'd1', total: 0, events: [] });
  });

  it('el panel del firmante reúne requisitos, validaciones con sus números, firma y enlace', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(detail({ signers: [completo()] }));
    const text = abrirPanel(fixture, host).textContent?.replace(/\s+/g, ' ') ?? '';
    expect(host.querySelector('.sp__meta')?.textContent?.trim()).toBe('Firmante · luis@x.co');
    for (const part of [
      'Luis Mora',
      'Identidad y validaciones',
      'Validación contra documento',
      'Biometría avanzada',
      'Consultar Registraduría',
      'Del documento, frente y reverso',
      '97 / 90',
      '61 / 80',
      'VIGENTE',
      '"similitud": 0.93',
      '1 de 3',
      'Firma y expediente',
      'Clave dinámica',
      'Correo, WhatsApp',
      'Cali, Valle, Colombia',
      'según ipinfo',
      'Activo',
      'El enlace no se muestra.',
    ]) {
      expect(text, part).toContain(part);
    }
    expect(host.textContent).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
  });

  it('los archivos del firmante se abren en otra pestaña, también los del historial, y uno que falta dice por qué', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(detail({ signers: [completo()] }));
    const panel = abrirPanel(fixture, host);
    const restore = stubObjectUrls();
    const pestana = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window);
    const [actual, rechazada] = [
      ...panel.querySelectorAll<HTMLButtonElement>('dba-signer-record .sr__list button'),
    ];
    actual.click();
    http.expectOne('/platform/documents/d1/signers/i2/files/selfie').flush(new Blob(['jpg']));
    await vi.waitFor(() => expect(pestana.location.href).toBe('blob:prueba'));
    fixture.detectChanges();
    const mal = vi.spyOn(TestBed.inject(NotificationService), 'error');
    rechazada.click();
    http
      .expectOne('/platform/documents/d1/signers/i2/files/selfie?history=0')
      .flush(new Blob([JSON.stringify({ code: 'EVIDENCIA_NO_ENCONTRADA' })]), {
        status: 404,
        statusText: 'Not Found',
      });
    await vi.waitFor(() => expect(mal).toHaveBeenCalledWith('El firmante no tiene ese archivo.'));
    expect(pestana.close).toHaveBeenCalled();
    restore();
  });

  it('«Datos completos» del firmante dice qué se ocultó y que los archivos se ven en el panel', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(detail({ signers: [completo()] }));
    boton(abrirPanel(fixture, host), 'Datos completos').click();
    fixture.detectChanges();
    http.expectOne('/platform/documents/d1/signers/i2/raw').flush({
      id: 'd1',
      identityId: 'i2',
      data: { names: 'Luis', checkDataRegistry: true },
      hidden: [
        { path: 'photoFront', reason: 'files' },
        { path: 'passkeyToken', reason: 'secret' },
      ],
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('.raw__code')?.textContent).toContain('"checkDataRegistry": true');
    });
    const ocultos = host.querySelector('.raw__hidden')?.textContent ?? '';
    expect(ocultos).toContain('Archivos (se ven en el panel del firmante, con auditoría)');
    expect(ocultos).toContain('photoFront');
    expect(ocultos).toContain('Secretos');
    expect(host.querySelector('dba-raw-data')?.textContent).toContain('Luis Mora');
    expect(host.textContent).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
  });

  it('«Ver en Firmantes» sale solo con lectura de Clientes y lleva a la ficha del firmante', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(detail({ signers: [completo()] }));
    const panel = abrirPanel(fixture, host);
    const enlace = () => panel.querySelector<HTMLAnchorElement>('a[dba-button]');
    expect(enlace()).toBeNull();
    conPermisos(['platform:operations', 'platform:clients']);
    fixture.detectChanges();
    expect(enlace()?.getAttribute('href')).toBe(`${sectionPath('signers')}/s2`);
    expect(enlace()?.textContent).toContain('Ver en Firmantes');
  });

  it('un firmante con la firma retenida sale «Por aprobar» y el panel dice desde cuándo', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(
      detail({
        signers: [
          completo({
            signature: undefined,
            approval: {
              status: 'pending',
              held: true,
              heldSince: '2026-10-21T10:05:00.000Z',
              requestedAt: '2026-10-21T10:05:00.000Z',
            },
          }),
        ],
      }),
    );
    const panel = abrirPanel(fixture, host);
    expect(host.querySelector('.sg__row')?.textContent).toContain('Por aprobar');
    expect(panel.textContent).toContain('Firma retenida desde');
    expect(panel.textContent).toContain('Por aprobar');
  });

  it('versiones de la más nueva a la vieja con la actual marcada y separar solo con permiso', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar();
    tab(host, 'Versiones').click();
    fixture.detectChanges();
    const rows = host.querySelectorAll('.vs__row');
    expect(rows[0].textContent).toContain('v2');
    expect(rows[0].textContent).toContain('Actual');
    expect(rows[0].textContent).toContain('bbbbbbbb…bbbbbbbb');
    expect(rows[1].textContent).not.toContain('Actual');
    expect(host.querySelector('[aria-label="Separar"]')).toBeNull();
    expect(host.textContent).toContain('Ver PDF');
    expect(host.querySelector('dba-document-versions')?.textContent).not.toContain('Vence');
  });

  it('la trazabilidad usa la etiqueta conocida, cae al código y muestra la razón', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar();
    tab(host, 'Trazabilidad').click();
    fixture.detectChanges();
    const text = host.querySelector('dba-document-trace')?.textContent ?? '';
    expect(text).toContain('Finalizado por administración');
    expect(text).toContain('Razón: pedido');
    expect(text).toContain('Sistema');
    expect(host.querySelector('dba-document-trace code.dba-ref')?.textContent).toBe('algo.nuevo');
    expect(text).toContain('10.0.0.1');
  });

  it('la trazabilidad explica invitaciones, causas y validaciones, y filtra solo lo que falló', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(detail(), [
      {
        type: 'document.close_failed',
        timestamp: '2026-10-24T10:00:00.000Z',
        actor: { type: 'system' },
        details: { error: 'El servicio de firma rechazó la petición' },
      },
      {
        type: 'identity.failed',
        timestamp: '2026-10-23T12:00:00.000Z',
        actor: { type: 'signer', name: 'Luis Mora' },
        details: { fields: ['email', 'phone'], variant: 'basic', attempts: 2, max: 6 },
      },
      {
        type: 'notification.sent',
        timestamp: '2026-10-23T10:00:00.000Z',
        actor: { type: 'user', name: 'Marta Vidal' },
        details: { sent: false, error: 'sin correo' },
      },
      {
        type: 'notification.sent',
        timestamp: '2026-10-22T10:00:00.000Z',
        actor: { type: 'user', name: 'Marta Vidal' },
        details: { sent: true, email: 'ana@x.co' },
      },
    ]);
    tab(host, 'Trazabilidad').click();
    fixture.detectChanges();
    const trace = host.querySelector('dba-document-trace')!;
    expect(trace.textContent).toContain('Causa: El servicio de firma rechazó la petición');
    expect(trace.textContent).toContain('Datos que no coinciden: Correo, Celular');
    expect(trace.textContent).toContain('Intento 2 de 6');
    expect(trace.textContent).toContain('Invitación no enviada');
    expect(trace.textContent).toContain('Sin correo: el firmante no tiene correo registrado');
    expect(trace.textContent).toContain('Correo enviado a ana@x.co');
    expect(trace.querySelectorAll('.tr__line--failed').length).toBe(3);

    const pills = [...trace.querySelectorAll<HTMLButtonElement>('db-filter-pills .pill')];
    expect(pills.map((pill) => pill.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Todo 4',
      'Solo lo que falló 3',
    ]);
    pills[1].click();
    fixture.detectChanges();
    expect(trace.querySelectorAll('dba-audit-event')).toHaveLength(3);
    expect(trace.textContent).not.toContain('Correo enviado a ana@x.co');
  });

  it('sin fallas, «Solo lo que falló» lo dice en vez de quedar en blanco', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar(detail(), [events[0]]);
    tab(host, 'Trazabilidad').click();
    fixture.detectChanges();
    const trace = host.querySelector('dba-document-trace')!;
    trace.querySelectorAll<HTMLButtonElement>('db-filter-pills .pill')[1].click();
    fixture.detectChanges();
    expect(trace.querySelectorAll('dba-audit-event')).toHaveLength(0);
    expect(trace.textContent).toContain('Nada falló en este documento.');
  });

  it('Versiones pinta los comentarios con su autor, de lo más nuevo a lo más viejo', async () => {
    conPermisos(['platform:operations']);
    const base = detail();
    const { fixture, host } = await montar(
      detail({
        versions: [
          {
            ...base.versions[0],
            comments: [
              {
                signerId: 'i1',
                comment: 'Falta la cláusula de mora',
                date: '2026-10-20T12:00:00.000Z',
              },
              { signerId: 'i1', comment: '   ' },
            ],
          },
          {
            ...base.versions[1],
            comments: [
              {
                signerId: '',
                userId: 'u9',
                comment: 'Se agregó la cláusula',
                date: '2026-10-21T12:00:00.000Z',
              },
              { signerId: 'i404', comment: 'Revisado', date: '2026-10-21T09:00:00.000Z' },
            ],
          },
        ],
      }),
    );
    tab(host, 'Versiones').click();
    fixture.detectChanges();
    const section = host.querySelector('.vs__comments')!;
    expect(section.textContent).toContain('Comentarios de las versiones (3)');
    const items = [...section.querySelectorAll('dba-audit-event')].map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('Usuario de la organización');
    expect(items[0]).toContain('Se agregó la cláusula');
    expect(items[0]).toContain('v2');
    expect(items[1]).toContain('Firmante');
    expect(items[1]).toContain('Revisado');
    expect(items[2]).toContain('Ana Ruiz');
    expect(items[2]).toContain('Falta la cláusula de mora');
    expect(items[2]).toContain('v1');
  });

  it('Versiones sin comentarios no pinta la sección', async () => {
    conPermisos(['platform:operations']);
    const { fixture, host } = await montar();
    tab(host, 'Versiones').click();
    fixture.detectChanges();
    expect(host.querySelector('.vs__comments')).toBeNull();
  });
});
