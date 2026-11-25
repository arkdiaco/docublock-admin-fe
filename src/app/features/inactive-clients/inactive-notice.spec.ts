import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { DialogService } from '../../core/ui/dialog.service';
import { conPermisos, configurar } from '../catalogs/pages/catalogs-test-kit';
import type {
  InactiveOrganizationRow,
  InactiveOrganizationsPage,
} from './data/inactive-clients.models';
import { rowExportStageOf } from './data/inactive-export-stage';
import { InactiveClientsComponent } from './pages/inactive-clients.component';

const ORG = 'org-1';
const LISTA = '/platform/inactive-organizations';
const AVISOS = `/platform/inactive-organizations/${ORG}/notices`;
const LLAVE_CRUDA = /\b(inactive|nav|common|sub|dialog)\.[a-zA-Z.]+/;

const fila = (over: Partial<InactiveOrganizationRow> = {}): InactiveOrganizationRow => ({
  organization: {
    id: ORG,
    businessName: 'Notaría Central',
    tributaryNumber: '900111',
    email: 'notaria@central.co',
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
  ...over,
});

const pagina = (items: InactiveOrganizationRow[]): InactiveOrganizationsPage => ({
  months: 6,
  cutoff: '2026-05-20T15:00:00.000Z',
  computedAt: '2026-11-20T08:00:00.000Z',
  total: items.length,
  items,
});

const LISTA_VIGENTE = {
  state: 'done' as const,
  createdAt: '2026-11-20T10:00:00.000Z',
  expiresAt: '2026-12-20T10:05:00.000Z',
  expired: false,
};

const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

const asentar = async (fixture: ComponentFixture<unknown>) => {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
};

describe('Clientes inactivos › estado de la descarga en la fila', () => {
  it('sin descarga, en curso, lista, vencida o fallida', () => {
    expect(rowExportStageOf(null)).toBe('none');
    expect(rowExportStageOf({ ...LISTA_VIGENTE, state: 'running', expiresAt: null })).toBe(
      'running',
    );
    expect(rowExportStageOf(LISTA_VIGENTE)).toBe('ready');
    expect(rowExportStageOf({ ...LISTA_VIGENTE, expired: true })).toBe('expired');
    expect(rowExportStageOf({ ...LISTA_VIGENTE, state: 'failed', expiresAt: null })).toBe('failed');
  });
});

describe('Clientes inactivos › aviso de eliminación', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  const montar = async (permisos: string[], items: InactiveOrganizationRow[]) => {
    conPermisos(permisos);
    const fixture = TestBed.createComponent(InactiveClientsComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === LISTA).flush(pagina(items));
    await asentar(fixture);
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  const opciones = () =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].map((i) => ({
      texto: texto(i),
      apagada: i.disabled,
    }));

  const abrirMenu = async (fixture: ComponentFixture<unknown>, root: HTMLElement) => {
    root.querySelector<HTMLButtonElement>('.inactive__more')!.click();
    await asentar(fixture);
  };

  const elegir = async (fixture: ComponentFixture<unknown>, nombre: string) => {
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((i) => texto(i).startsWith(nombre))!
      .click();
    await asentar(fixture);
  };

  it('con permiso de gestionar el menú ofrece enviar el aviso', async () => {
    const { fixture, root } = await montar(['platform:clients:manage'], [fila()]);
    await abrirMenu(fixture, root);
    expect(opciones().map((o) => o.texto)).toEqual([
      'Descargar documentos',
      'Enviar aviso de eliminación',
      'Ver organización',
    ]);
  });

  it('solo con lectura el aviso no aparece', async () => {
    const { fixture, root } = await montar(['platform:clients'], [fila()]);
    await abrirMenu(fixture, root);
    expect(opciones().map((o) => o.texto)).toEqual(['Descargar documentos', 'Ver organización']);
  });

  it('sin correo registrado el aviso sale apagado y dice por qué', async () => {
    const { fixture, root } = await montar(
      ['platform:clients:manage'],
      [fila({ organization: { ...fila().organization, email: null } })],
    );
    await abrirMenu(fixture, root);
    const aviso = opciones().find((o) => o.texto.startsWith('Enviar aviso'))!;
    expect(aviso.apagada).toBe(true);
    expect(aviso.texto).toContain('No tiene correo registrado');
  });

  it('pide motivo y escribir el NIT, y dice a quién le llega y desde cuándo se elimina', async () => {
    const { fixture, root } = await montar(['platform:clients:manage'], [fila()]);
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'cancel' });
    await abrirMenu(fixture, root);
    await elegir(fixture, 'Enviar aviso');
    expect(abrir).toHaveBeenCalledTimes(1);
    const pedido = abrir.mock.calls[0][0];
    expect(pedido.challenge?.identifier).toBe('900111');
    expect(pedido.reason?.required).toBe(true);
    expect(pedido.params).toMatchObject({
      name: 'Notaría Central',
      email: 'notaria@central.co',
      date: '24/12/2026',
    });
    expect(pedido.warnings).toEqual([
      'No hay una descarga vigente: el correo lleva el botón para entrar a Docublock. Si quieres que lleve el enlace, genera primero la descarga.',
    ]);
  });

  it('con una descarga vigente avisa que el correo lleva el enlace, y si ya se avisó lo dice', async () => {
    const { fixture, root } = await montar(
      ['platform:clients:manage'],
      [
        fila({
          lastExport: LISTA_VIGENTE,
          lastNotice: {
            sentAt: '2026-11-10T15:00:00.000Z',
            deletionDate: '2026-12-10T15:00:00.000Z',
            count: 1,
          },
        }),
      ],
    );
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'cancel' });
    await abrirMenu(fixture, root);
    await elegir(fixture, 'Enviar aviso');
    expect(abrir.mock.calls[0][0].warnings).toEqual([
      'Ya se le avisó el 10/11/2026. Este será el envío número 2.',
      'El correo lleva el enlace de descarga vigente, que sirve hasta el 20/12/2026.',
    ]);
  });

  it('al cancelar no envía nada', async () => {
    const { fixture, root } = await montar(['platform:clients:manage'], [fila()]);
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({ answer: 'cancel' });
    await abrirMenu(fixture, root);
    await elegir(fixture, 'Enviar aviso');
    http.expectNone(AVISOS);
  });

  it('al confirmar envía motivo y NIT, avisa a quién salió y recarga la lista', async () => {
    const { fixture, root } = await montar(['platform:clients:manage'], [fila()]);
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Depuración de inactivos',
    });
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    await abrirMenu(fixture, root);
    await elegir(fixture, 'Enviar aviso');
    let post!: ReturnType<HttpTestingController['expectOne']>;
    await vi.waitFor(() => {
      post = http.expectOne(AVISOS);
    });
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      reason: 'Depuración de inactivos',
      tributaryNumber: '900111',
    });
    post.flush({ id: 'n-1', email: 'notaria@central.co' });
    await asentar(fixture);
    expect(avisos.mock.calls[0][0].detail).toBe('Aviso enviado a notaria@central.co.');
    const recarga = http.expectOne((r) => r.url === LISTA);
    recarga.flush(
      pagina([
        fila({
          lastNotice: {
            sentAt: '2026-11-24T15:00:00.000Z',
            deletionDate: '2026-12-24T15:00:00.000Z',
            count: 1,
          },
        }),
      ]),
    );
    await asentar(fixture);
    expect(texto(root.querySelector('.dba-tr'))).toContain('Enviado el 24/11/2026');
  });

  it('traduce los errores conocidos y deja uno general para el resto', async () => {
    const casos: [number, string | null, string][] = [
      [400, 'CONFIRMACION_INVALIDA', 'El NIT no coincide con el de la organización.'],
      [422, 'ORGANIZACION_SIN_CORREO', 'La organización no tiene correo registrado.'],
      [404, 'ORGANIZACION_NO_ENCONTRADA', 'La organización ya no existe.'],
      [503, null, 'No se pudo enviar el aviso. Inténtalo de nuevo.'],
    ];
    const { fixture, root } = await montar(['platform:clients:manage'], [fila()]);
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'x',
    });
    const avisos = vi.spyOn(TestBed.inject(MessageService), 'add');
    for (const [status, code, mensaje] of casos) {
      avisos.mockClear();
      await abrirMenu(fixture, root);
      await elegir(fixture, 'Enviar aviso');
      let post!: ReturnType<HttpTestingController['expectOne']>;
      await vi.waitFor(() => {
        post = http.expectOne(AVISOS);
      });
      post.flush(code ? { code } : 'x', { status, statusText: 'x' });
      await asentar(fixture);
      expect(avisos.mock.calls[0][0].detail).toBe(mensaje);
      http.expectNone((r) => r.url === LISTA);
    }
  });

  it('las columnas dicen el último aviso y el estado de la descarga', async () => {
    const { root } = await montar(
      ['platform:clients'],
      [
        fila({
          organization: { ...fila().organization, id: 'a' },
          lastNotice: {
            sentAt: '2026-11-24T15:00:00.000Z',
            deletionDate: '2026-12-24T15:00:00.000Z',
            count: 2,
          },
          lastExport: LISTA_VIGENTE,
        }),
        fila({ organization: { ...fila().organization, id: 'b' } }),
        fila({
          organization: { ...fila().organization, id: 'c' },
          lastNotice: {
            sentAt: '2026-11-24T15:00:00.000Z',
            deletionDate: '2026-12-24T15:00:00.000Z',
            count: 1,
          },
          lastExport: { ...LISTA_VIGENTE, expired: true },
        }),
        fila({
          organization: { ...fila().organization, id: 'd' },
          lastExport: { ...LISTA_VIGENTE, state: 'running', expiresAt: null },
        }),
        fila({
          organization: { ...fila().organization, id: 'e' },
          lastExport: { ...LISTA_VIGENTE, state: 'failed', expiresAt: null },
        }),
      ],
    );
    const filas = [...root.querySelectorAll('.dba-tr')].map((f) => texto(f));
    expect(filas[0]).toContain('Enviado el 24/11/2026 · 2 envíos');
    expect(filas[0]).toContain('Se elimina desde 24/12/2026');
    expect(filas[0]).toContain('Lista');
    expect(filas[0]).toContain('Hasta 20/12/2026');
    expect(filas[1]).toContain('Sin aviso');
    expect(filas[1]).toContain('Sin descarga');
    expect(filas[2]).toContain('Se elimina desde 24/12/2026');
    expect(filas[2]).not.toContain('envíos');
    expect(filas[2]).toContain('Vencida');
    expect(filas[2]).toContain('Desde 20/12/2026');
    expect(filas[3]).toContain('Armando');
    expect(filas[4]).toContain('Falló');
    expect(texto(root)).not.toMatch(LLAVE_CRUDA);
  });
});
