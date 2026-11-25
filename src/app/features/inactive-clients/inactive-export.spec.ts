import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { conPermisos, configurar } from '../catalogs/pages/catalogs-test-kit';
import {
  EXPORT_POLL_MS,
  InactiveExportDialogComponent,
} from './components/inactive-export-dialog.component';
import type {
  InactiveExportView,
  InactiveOrganizationRow,
  InactiveOrganizationsPage,
} from './data/inactive-clients.models';
import {
  exportBytesOf,
  exportDocumentsOf,
  exportPercentOf,
  exportStageOf,
  megabytesOf,
} from './data/inactive-export-stage';
import { InactiveClientsComponent } from './pages/inactive-clients.component';

const ORG = 'org-1';
const RUTA = `/platform/inactive-organizations/${ORG}/export`;
const ENLACE = 'https://core.test/api/core/public/inactive-exports/tok';
const LLAVE_CRUDA = /\b(inactive|nav|common|sub)\.[a-zA-Z.]+/;

const vista = (over: Partial<InactiveExportView> = {}): InactiveExportView => ({
  id: 'x1',
  state: 'done',
  total: 5,
  processed: 5,
  parts: [
    { index: 1, bytes: 63127667, documents: 3 },
    { index: 2, bytes: 62916854, documents: 2 },
  ],
  omitted: [],
  createdAt: '2026-11-20T20:58:00.000Z',
  finishedAt: '2026-11-20T20:59:00.000Z',
  expiresAt: '2026-12-20T20:59:00.000Z',
  expired: false,
  url: ENLACE,
  error: null,
  ...over,
});

const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const asentar = async (fixture: ComponentFixture<unknown>) => {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
};

describe('Clientes inactivos › etapa de la descarga', () => {
  it('sin exportación no hay etapa; en curso, lista, vencida o fallida según el estado', () => {
    expect(exportStageOf(null)).toBe('none');
    expect(exportStageOf(vista({ state: 'running', url: null }))).toBe('running');
    expect(exportStageOf(vista())).toBe('ready');
    expect(exportStageOf(vista({ expired: true, url: null }))).toBe('expired');
    expect(exportStageOf(vista({ state: 'failed', url: null }))).toBe('failed');
  });

  it('calcula el avance, el peso y los documentos de las partes', () => {
    expect(exportPercentOf(vista({ processed: 2, total: 8 }))).toBe(25);
    expect(exportPercentOf(vista({ processed: 0, total: 0 }))).toBe(0);
    expect(exportPercentOf(vista({ processed: 9, total: 8 }))).toBe(100);
    expect(exportDocumentsOf(vista())).toBe(5);
    expect(megabytesOf(exportBytesOf(vista()))).toBe(120.2);
  });
});

describe('Clientes inactivos › ventana de descarga', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  const abrir = async (permisos: string[], respuesta: InactiveExportView | null) => {
    conPermisos(permisos);
    const fixture = TestBed.createComponent(InactiveExportDialogComponent);
    fixture.componentRef.setInput('organizationId', ORG);
    fixture.componentRef.setInput('orgName', 'Notaría Central');
    fixture.componentRef.setInput('canManage', permisos.includes('platform:clients:manage'));
    const cerrado = vi.fn();
    fixture.componentInstance.closed.subscribe(cerrado);
    fixture.detectChanges();
    const req = http.expectOne(RUTA);
    expect(req.request.method).toBe('GET');
    req.flush(respuesta);
    await asentar(fixture);
    return { fixture, root: fixture.nativeElement as HTMLElement, cerrado };
  };

  const confirmar = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('.foot__go')!;

  const escribirMotivo = async (
    fixture: ComponentFixture<unknown>,
    root: HTMLElement,
    motivo: string,
  ) => {
    const input = root.querySelector<HTMLInputElement>('dba-field input')!;
    input.value = motivo;
    input.dispatchEvent(new Event('input'));
    await asentar(fixture);
  };

  it('sin descarga previa explica qué se arma y no deja generar sin motivo', async () => {
    const { root } = await abrir(['platform:clients:manage'], null);
    expect(texto(root)).toContain('expediente completo de cada documento');
    expect(texto(root)).toContain('30 días');
    expect(texto(confirmar(root))).toBe('Generar enlace');
    expect(confirmar(root).disabled).toBe(true);
    expect(texto(root)).not.toMatch(LLAVE_CRUDA);
  });

  it('genera con el motivo, muestra el avance y consulta de nuevo hasta que queda lista', async () => {
    vi.useFakeTimers();
    const { fixture, root } = await abrir(['platform:clients:manage'], null);
    await escribirMotivo(fixture, root, '  Cliente pidió sus documentos ');
    expect(confirmar(root).disabled).toBe(false);
    confirmar(root).click();
    const post = http.expectOne(RUTA);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ reason: 'Cliente pidió sus documentos' });
    post.flush(vista({ state: 'running', processed: 2, total: 8, parts: [], url: null }));
    await asentar(fixture);
    expect(texto(root)).toContain('Armando la descarga');
    expect(texto(root)).toContain('Van 2 de 8 documentos');
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
    expect(texto(confirmar(root))).toBe('Listo');

    vi.advanceTimersByTime(EXPORT_POLL_MS);
    http.expectOne(RUTA).flush(vista());
    await asentar(fixture);
    expect(texto(root)).toContain('El enlace está listo');
    expect(texto(root)).toContain(ENLACE);
    expect(texto(root)).toMatch(/2 partes · 5 documentos · 120[.,]2 MB/);
    expect(texto(root)).toContain('Sirve hasta el 20/12/2026');
    vi.advanceTimersByTime(EXPORT_POLL_MS * 3);
  });

  it('copia el enlace al portapapeles', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribir },
      configurable: true,
    });
    const { fixture, root } = await abrir(['platform:clients'], vista());
    const copiar = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      texto(b).includes('Copiar enlace'),
    )!;
    copiar.click();
    await asentar(fixture);
    expect(escribir).toHaveBeenCalledWith(ENLACE);
    expect(texto(root)).toContain('Enlace copiado');
  });

  it('con un enlace vigente ofrece generar otro sin quitar el actual', async () => {
    const { fixture, root } = await abrir(['platform:clients:manage'], vista());
    expect(root.querySelector('dba-field')).toBeNull();
    const otro = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      texto(b).includes('Generar un enlace nuevo'),
    )!;
    otro.click();
    await asentar(fixture);
    expect(root.querySelector('dba-field')).not.toBeNull();
    expect(texto(root)).toContain('El enlace actual sigue sirviendo hasta que venza');
    expect(texto(root)).toContain(ENLACE);
  });

  it('solo con lectura ve el enlace pero no puede generar', async () => {
    const { root } = await abrir(['platform:clients'], vista());
    expect(texto(root)).toContain(ENLACE);
    expect(texto(root)).not.toContain('Generar un enlace nuevo');
    expect(root.querySelector('dba-field')).toBeNull();
  });

  it('solo con lectura y sin descarga lo dice y cierra con Listo', async () => {
    const { root, cerrado } = await abrir(['platform:clients'], null);
    expect(texto(root)).toContain('todavía no tiene un enlace de descarga');
    expect(texto(confirmar(root))).toBe('Listo');
    confirmar(root).click();
    expect(cerrado).toHaveBeenCalled();
  });

  it('dice cuándo venció el último enlace y deja generar otro', async () => {
    const { root } = await abrir(['platform:clients:manage'], vista({ expired: true, url: null }));
    expect(texto(root)).toContain('El último enlace venció el 20/12/2026');
    expect(texto(root)).not.toContain(ENLACE);
    expect(texto(confirmar(root))).toBe('Generar enlace');
  });

  it('avisa si la última falló', async () => {
    const { root } = await abrir(
      ['platform:clients:manage'],
      vista({ state: 'failed', url: null, error: 'x' }),
    );
    expect(texto(root)).toContain('no se pudo armar');
    expect(texto(root)).not.toContain('x —');
  });

  it('lista los documentos que no se pudieron incluir con su motivo', async () => {
    const { root } = await abrir(
      ['platform:clients'],
      vista({
        omitted: [
          { id: 'd1', code: 'CI3-G', name: 'Contrato grande', reason: 'MUY_GRANDE' },
          { id: 'd2', code: null, name: '', reason: 'NO_DISPONIBLE' },
        ],
      }),
    );
    const lista = texto(root);
    expect(lista).toContain('2 documentos no se pudieron incluir');
    expect(lista).toContain('Contrato grande · CI3-G — su expediente pesa más de 100 MB');
    expect(lista).toContain('d2 — su expediente no se pudo armar');
    expect(lista).not.toMatch(LLAVE_CRUDA);
  });

  it('si ya hay una en curso lo avisa y muestra su avance', async () => {
    const { fixture, root } = await abrir(['platform:clients:manage'], null);
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    await escribirMotivo(fixture, root, 'otra');
    confirmar(root).click();
    http
      .expectOne(RUTA)
      .flush({ code: 'EXPORTACION_EN_CURSO' }, { status: 409, statusText: 'Conflict' });
    await asentar(fixture);
    expect(avisos.mock.calls[0][0].detail).toBe(
      'Ya se está armando una descarga para esta organización.',
    );
    http
      .expectOne(RUTA)
      .flush(vista({ state: 'running', processed: 1, total: 3, parts: [], url: null }));
    await asentar(fixture);
    expect(texto(root)).toContain('Van 1 de 3 documentos');
    fixture.destroy();
  });

  it('si no carga deja reintentar', async () => {
    conPermisos(['platform:clients']);
    const fixture = TestBed.createComponent(InactiveExportDialogComponent);
    fixture.componentRef.setInput('organizationId', ORG);
    fixture.componentRef.setInput('orgName', 'Notaría Central');
    fixture.detectChanges();
    http.expectOne(RUTA).flush('x', { status: 500, statusText: 'x' });
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(texto(root)).toContain('No pudimos consultar la descarga');
    [...root.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => texto(b) === 'Reintentar')!
      .click();
    http.expectOne(RUTA).flush(null);
  });
});

describe('Clientes inactivos › acciones de la fila', () => {
  let http: HttpTestingController;

  const fila: InactiveOrganizationRow = {
    organization: {
      id: ORG,
      businessName: 'Notaría Central',
      tributaryNumber: '900111',
      email: null,
      suspended: false,
    },
    lastActivityAt: '2026-04-12T15:00:00.000Z',
    lastDocumentAt: null,
    lastSignatureAt: null,
    documents: 4,
    signedDocuments: 3,
    monthsInactive: 7,
    plan: null,
    lastNotice: null,
    lastExport: null,
  };

  const pagina: InactiveOrganizationsPage = {
    months: 6,
    cutoff: '2026-05-20T15:00:00.000Z',
    computedAt: '2026-11-20T08:00:00.000Z',
    total: 1,
    items: [fila],
  };

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async () => {
    conPermisos(['platform:clients:manage']);
    const fixture = TestBed.createComponent(InactiveClientsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/platform/inactive-organizations').flush(pagina);
    await asentar(fixture);
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('el menú de la fila no abre el detalle y ofrece descargar y ver la organización', async () => {
    const { fixture, root } = await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('.inactive__more')!.click();
    await asentar(fixture);
    expect(navegar).not.toHaveBeenCalled();
    const opciones = [...document.querySelectorAll('[role="menuitem"]')].map((i) => texto(i));
    expect(opciones).toEqual([
      'Descargar documentos',
      'Enviar aviso de eliminación No tiene correo registrado',
      'Ver organización',
    ]);
    document.querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await asentar(fixture);
    http.expectOne(RUTA).flush(null);
    await asentar(fixture);
    expect(texto(root.querySelector('dba-inactive-export-dialog'))).toContain('Notaría Central');
  });

  it('con Enter sobre la fila abre el detalle', async () => {
    const { root } = await montar();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    root
      .querySelector<HTMLElement>('.dba-tr')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navegar).toHaveBeenCalledWith(['/clientes/organizaciones', ORG]);
  });
});
