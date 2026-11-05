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
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import type { PlatformDocumentDetail, TraceEvent } from '../data/documents.models';
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
  organization: { id: 'o1', businessName: 'Notaría 14' },
  owner: { id: 'u1', names: 'Marta Vidal' },
  status: { progress: 2, state: 0, label: 'parcialmente firmado' },
  signedCount: 2,
  signerCount: 2,
  anchored: false,
  createdAt: '2026-10-20T10:00:00.000Z',
  signers: [
    {
      identityId: 'i1',
      name: 'Ana Ruiz',
      email: 'ana@x.co',
      order: 1,
      role: 'Firmante',
      checked: true,
      signingAttempts: 0,
      blocked: false,
    },
    {
      identityId: 'i2',
      name: 'Luis Mora',
      order: 2,
      role: 'Firmante',
      checked: true,
      signingAttempts: 3,
      blocked: true,
      evidence: { liveness: { sessionId: 's', passed: true, confidence: 98 } },
    },
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
  ...over,
});

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

  afterEach(() => http.verify());

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

  it('cabecera, resumen y pestañas con conteos; solo lectura no ofrece acciones', async () => {
    conPermisos(['platform:operations']);
    const { host } = await montar();
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Contrato de arriendo');
    expect(host.querySelector('.rec__card')?.textContent).toContain('En progreso');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('CA-0001');
    expect(host.querySelector('.dd__dl')?.textContent).toContain('Marta Vidal');
    expect(host.querySelector('db-underline-tabs')?.textContent).toContain('Firmantes2');
    expect(host.querySelector('.dd__actions button')).toBeNull();
    expect(host.textContent).not.toMatch(/\b(docs|nav|common)\.[a-zA-Z]/);
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

  it('firmantes con estado, evidencia desplegable y desbloqueo con razón', async () => {
    conPermisos(['platform:operations', 'platform:operations:manage']);
    const { fixture, host } = await montar(
      detail({ signers: [{ ...detail().signers[1], checked: false }] }),
    );
    tab(host, 'Firmantes').click();
    fixture.detectChanges();
    const row = host.querySelector('.sg__row');
    expect(row?.textContent).toContain('Luis Mora');
    expect(row?.textContent).toContain('Bloqueado');
    host.querySelector<HTMLButtonElement>('.sg__toggle')!.click();
    fixture.detectChanges();
    expect(host.querySelector('.sg__evidence')?.textContent).toContain('Liveness');
    expect(host.querySelector('.sg__evidence')?.textContent).toContain('Aprobada');
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
