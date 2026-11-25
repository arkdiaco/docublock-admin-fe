import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import {
  actorPartsOf,
  affectedOf,
  contextLinesOf,
  filtersOf,
  groupStateOf,
  queryParamsOf,
  stateActionsOf,
  statePills,
} from '../data/error-log-view';
import type {
  ErrorContext,
  ErrorGroupDetail,
  ErrorGroupReport,
  ErrorGroupRow,
} from '../data/error-logs.models';
import {
  ERROR_LOGS_DEBOUNCE_MS,
  ERROR_LOGS_LIMIT,
  ErrorLogsComponent,
} from './error-logs.component';

const LLAVE_CRUDA = /\b(errl|nav|common)\.[a-zA-Z]/;
const BASE = '/platform/error-logs';
const ID = '65a0000000000000000000e1';

const ABIERTO: ErrorGroupRow = {
  id: ID,
  service: 'bridge',
  source: 'http',
  kind: 'ServiceUnavailableException',
  route: 'GET /fianza-credito/digital/ciudades',
  message: 'Fianzacredito no está configurado',
  lastStatus: 503,
  state: 'open',
  count: 7,
  firstSeen: '2026-11-17T20:00:00.000Z',
  lastSeen: '2026-11-17T22:00:00.000Z',
};

const RESUELTO: ErrorGroupRow = {
  ...ABIERTO,
  id: '65a0000000000000000000e2',
  service: 'core',
  source: 'job',
  kind: 'TypeError',
  route: 'job plan-reminders',
  message: 'Sin plan',
  lastStatus: null,
  state: 'resolved',
  count: 1,
  triage: { adminId: 'adm1', adminName: 'Marta Vidal', at: '2026-11-17T21:00:00.000Z' },
};

const DETALLE: ErrorGroupDetail = {
  ...ABIERTO,
  samples: [
    {
      id: 's1',
      occurredAt: '2026-11-17T22:00:00.000Z',
      message: 'Fianzacredito no está configurado',
      status: 503,
      method: 'GET',
      path: '/fianza-credito/digital/ciudades',
      query: { ciudad: 'Cali' },
      actor: { organizationId: 'org-1', integrationKeyId: 'llave-1' },
      requestId: 'req-77',
      stack: 'ServiceUnavailableException: Fianzacredito\n    at send',
    },
  ],
};

const DOC_ID = '0000000000000000000000c8';
const FIRMANTE_ID = '0000000000000000000000f1';
const ORG_ID = '0000000000000000000000d1';

const CONTEXTO: ErrorContext = {
  organization: { id: ORG_ID, name: 'Notaría Central', tributaryNumber: '900100001' },
  document: { id: DOC_ID, code: 'NI-0004', name: 'Contrato de arriendo' },
  signer: {
    id: FIRMANTE_ID,
    identityId: '0000000000000000000000a9',
    name: 'Ana Ruiz',
    identification: '1020304050',
  },
};

const FIRMA: ErrorGroupRow = {
  ...ABIERTO,
  service: 'core',
  route: 'POST /public/signing/sign',
  message: 'El servicio de firma rechazó la petición',
  affected: { documents: 3, capped: false },
};

const DETALLE_FIRMA: ErrorGroupDetail = {
  ...FIRMA,
  samples: [
    {
      ...DETALLE.samples[0],
      method: 'POST',
      path: '/public/signing/sign',
      actor: { organizationId: ORG_ID },
      context: CONTEXTO,
    },
  ],
};

const enlacesDelDetalle = () =>
  [...document.querySelectorAll<HTMLAnchorElement>('dba-error-log-detail a')].map((a) => ({
    texto: a.textContent?.trim(),
    href: a.getAttribute('href'),
  }));

const reporte = (items: ErrorGroupRow[]): ErrorGroupReport => ({
  total: items.length,
  page: 1,
  limit: ERROR_LOGS_LIMIT,
  items,
  totals: { open: 3, resolved: 2, silenced: 1 },
});

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET');

const LECTOR = ['platform:platform'];
const GESTOR = ['platform:platform', 'platform:platform:manage'];
const SOPORTE = ['platform:platform', 'platform:clients', 'platform:operations'];

const montar = async (url = '/', items = [ABIERTO, RESUELTO], permisos = LECTOR) => {
  const http = await configurar();
  conPermisos(permisos);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(ErrorLogsComponent);
  const primero = pedido(http);
  primero.flush(reporte(items));
  await asentar(fixture);
  return { fixture, http, primero, root: fixture.nativeElement as HTMLElement };
};

const botonesDelDetalle = () =>
  [...document.querySelectorAll<HTMLButtonElement>('dba-error-log-detail button')].map((b) =>
    b.textContent?.trim(),
  );

const botonDelDetalle = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('dba-error-log-detail button')].find(
    (b) => b.textContent?.trim() === texto,
  );

describe('Plataforma › Fallos', () => {
  it('lista los grupos con servicio, ruta, veces y estado, con los conteos por estado y sin llaves crudas', async () => {
    const { root, primero } = await montar();

    expect(primero.request.params.get('page')).toBe('1');
    expect(primero.request.params.get('limit')).toBe(String(ERROR_LOGS_LIMIT));
    expect(primero.request.params.has('state')).toBe(false);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Fallos');
    expect(texto).toContain('bridge');
    expect(texto).toContain('GET /fianza-credito/digital/ciudades');
    expect(texto).toContain('ServiceUnavailableException');
    expect(texto).toContain('Fianzacredito no está configurado');
    expect(texto).toContain('Abierto');
    expect(texto).toContain('Resuelto');
    expect(texto).toContain('Silenciado');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('lee los filtros de la URL y los manda al core', async () => {
    const { primero } = await montar(
      '/?estado=open&servicio=commons&buscar=push&periodo=24h&pagina=2',
    );
    const params = primero.request.params;
    expect(params.get('state')).toBe('open');
    expect(params.get('service')).toBe('commons');
    expect(params.get('search')).toBe('push');
    expect(params.get('page')).toBe('2');
    expect(Date.parse(params.get('from') ?? '')).toBeLessThan(Date.now() - 23 * 3_600_000);
  });

  it('la búsqueda espera a que se deje de escribir y vuelve a la primera página', async () => {
    const { root, http, fixture } = await montar('/?pagina=3');
    vi.useFakeTimers();
    try {
      const input = root.querySelector<HTMLInputElement>(
        'input[aria-label="Buscar por mensaje, ruta, documento, firmante u organización"]',
      );
      input!.value = ' fianza ';
      input!.dispatchEvent(new Event('input'));
      http.expectNone((req) => req.url.endsWith(BASE));
      vi.advanceTimersByTime(ERROR_LOGS_DEBOUNCE_MS);
    } finally {
      vi.useRealTimers();
    }
    const siguiente = pedido(http);
    expect(siguiente.request.params.get('search')).toBe('fianza');
    expect(siguiente.request.params.get('page')).toBe('1');
    siguiente.flush(reporte([]));
    await asentar(fixture);
    expect(root.textContent).toContain('Ningún fallo coincide con los filtros');
  });

  it('abrir un grupo muestra sus muestras con quién, parámetros y traza', async () => {
    const { root, http, fixture } = await montar();
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE);
    await asentar(fixture);

    const texto = document.querySelector('dba-error-log-detail')?.textContent ?? '';
    expect(texto).toContain('Últimas muestras (1)');
    expect(texto).toContain('503 · GET · /fianza-credito/digital/ciudades');
    expect(texto).toContain('Llave de integración');
    expect(texto).toContain('llave-1');
    expect(texto).toContain('req-77');
    expect(texto).toContain('"ciudad": "Cali"');
    expect(texto).toContain('at send');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('el enlace de Visión general abre el grupo directamente', async () => {
    const http = await configurar();
    conPermisos(LECTOR);
    await TestBed.inject(Router).navigateByUrl(`/?grupo=${ID}`);
    const fixture = TestBed.createComponent(ErrorLogsComponent);
    pedido(http).flush(reporte([ABIERTO]));
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE);
    await asentar(fixture);
    expect(document.querySelector('dba-error-log-detail')?.textContent).toContain(
      'GET /fianza-credito/digital/ciudades',
    );
  });

  it('solo lectura: el detalle no ofrece cambiar el estado', async () => {
    const { root, http, fixture } = await montar();
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE);
    await asentar(fixture);
    expect(botonesDelDetalle()).not.toContain('Marcar resuelto');
    expect(botonesDelDetalle()).not.toContain('Silenciar');
    expect(botonesDelDetalle()).toContain('Cerrar');
  });

  it('resolver pide motivo, llama al core, avisa y recarga', async () => {
    const { root, http, fixture } = await montar('/', [ABIERTO], GESTOR);
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE);
    await asentar(fixture);
    expect(botonesDelDetalle()).toContain('Silenciar');
    const abrir = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockResolvedValue({ answer: 'confirm', reason: 'Se configuró el token' });
    const exito = vi.spyOn(TestBed.inject(NotificationService), 'success');
    botonDelDetalle('Marcar resuelto')!.click();
    await vi.waitFor(() => expect(abrir).toHaveBeenCalled());
    expect(abrir.mock.calls[0][0]).toMatchObject({
      title: 'errl.confirm.resolved.title',
      params: { route: ABIERTO.route },
    });
    await vi.waitFor(() => {
      const post = http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}/state`));
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ state: 'resolved', reason: 'Se configuró el token' });
      post.flush({ ...ABIERTO, state: 'resolved' });
    });
    await vi.waitFor(() =>
      http
        .expectOne((req) => req.url.endsWith(`${BASE}/${ID}`))
        .flush({ ...DETALLE, state: 'resolved' }),
    );
    await vi.waitFor(() => pedido(http).flush(reporte([{ ...ABIERTO, state: 'resolved' }])));
    await asentar(fixture);
    expect(exito).toHaveBeenCalledWith('Fallo marcado como resuelto');
    expect(botonesDelDetalle()).toContain('Reabrir');
  });

  it('si otro lo cambió antes avisa con el código del core', async () => {
    const { root, http, fixture } = await montar('/', [ABIERTO], GESTOR);
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE);
    await asentar(fixture);
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'ruido',
    });
    const fallo = vi.spyOn(TestBed.inject(NotificationService), 'error');
    botonDelDetalle('Silenciar')!.click();
    await vi.waitFor(() =>
      http
        .expectOne((req) => req.url.endsWith(`${BASE}/${ID}/state`))
        .flush({ code: 'ERROR_GROUP_CHANGED' }, { status: 409, statusText: 'Conflict' }),
    );
    await vi.waitFor(() => pedido(http).flush(reporte([ABIERTO])));
    expect(fallo).toHaveBeenCalledWith(
      'Alguien cambió este fallo mientras lo revisabas. Recarga y vuelve a intentar.',
    );
  });

  it('si el core falla muestra el aviso y deja reintentar', async () => {
    const http = await configurar();
    conPermisos(LECTOR);
    const fixture = TestBed.createComponent(ErrorLogsComponent);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No se pudieron cargar los fallos');
    root.querySelector<HTMLButtonElement>('.bl__panel button')!.click();
    pedido(http).flush(reporte([ABIERTO]));
    await asentar(fixture);
    expect(root.textContent).toContain('GET /fianza-credito/digital/ciudades');
  });

  it('el buscador dice que encuentra por código del documento, identificación o NIT', async () => {
    const { root } = await montar();
    const input = root.querySelector<HTMLInputElement>('.bl__search input');
    expect(input?.placeholder).toBe('Mensaje, ruta, código del documento, identificación o NIT');
  });

  it('cada grupo dice cuántos documentos afectó', async () => {
    const { root } = await montar('/', [
      FIRMA,
      { ...RESUELTO, id: '65a0000000000000000000e3', affected: { documents: 1, capped: false } },
      { ...RESUELTO, id: '65a0000000000000000000e4', affected: { documents: 500, capped: true } },
      { ...RESUELTO, id: '65a0000000000000000000e5', affected: { documents: 0, capped: false } },
    ]);
    const filas = [...root.querySelectorAll('button.dba-tr')].map((f) => f.textContent ?? '');
    expect(filas[0]).toContain('3 documentos');
    expect(filas[1]).toContain('1 documento');
    expect(filas[1]).not.toContain('1 documentos');
    expect(filas[2]).toContain('500 o más documentos');
    expect(filas[3]).not.toContain('documento');
  });

  it('el detalle dice a qué documento, firmante y organización le pasó, con enlaces', async () => {
    const { root, http, fixture } = await montar('/', [FIRMA], SOPORTE);
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE_FIRMA);
    await asentar(fixture);

    const texto = document.querySelector('dba-error-log-detail')?.textContent ?? '';
    expect(texto).toContain('Documentos afectados');
    expect(texto).toContain('Documento');
    expect(texto).toContain('Firmante');
    expect(texto).not.toContain(ORG_ID);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    expect(enlacesDelDetalle()).toEqual([
      { texto: 'NI-0004 · Contrato de arriendo', href: `/operacion/documentos/${DOC_ID}` },
      { texto: 'Ana Ruiz · 1020304050', href: `/clientes/firmantes/${FIRMANTE_ID}` },
      { texto: 'Notaría Central · NIT 900100001', href: `/clientes/organizaciones/${ORG_ID}` },
    ]);
  });

  it('sin permiso para Documentos ni Clientes, el contexto se lee pero no se enlaza', async () => {
    const { root, http, fixture } = await montar('/', [FIRMA], LECTOR);
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE_FIRMA);
    await asentar(fixture);

    const texto = document.querySelector('dba-error-log-detail')?.textContent ?? '';
    expect(texto).toContain('NI-0004 · Contrato de arriendo');
    expect(texto).toContain('Ana Ruiz · 1020304050');
    expect(texto).toContain('Notaría Central · NIT 900100001');
    expect(enlacesDelDetalle()).toEqual([]);
  });

  it('las muestras viejas, sin contexto, siguen mostrando la organización del actor', async () => {
    const { root, http, fixture } = await montar('/', [ABIERTO], SOPORTE);
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/${ID}`)).flush(DETALLE);
    await asentar(fixture);

    const texto = document.querySelector('dba-error-log-detail')?.textContent ?? '';
    expect(texto).toContain('org-1');
    expect(texto).not.toContain('Documentos afectados');
    expect(enlacesDelDetalle()).toEqual([]);
  });

  it('desde un documento, la lista trae solo sus fallos, lo avisa y deja quitar el filtro', async () => {
    const { root, http, fixture, primero } = await montar(
      `/?documento=${DOC_ID}`,
      [FIRMA],
      SOPORTE,
    );
    expect(primero.request.params.get('document')).toBe(DOC_ID);
    const aviso = root.querySelector('.bl__scope');
    expect(aviso?.textContent).toContain('Solo los fallos de un documento');
    const verDocumento = aviso?.querySelector<HTMLAnchorElement>('a');
    expect(verDocumento?.textContent?.trim()).toBe('Ver documento');
    expect(verDocumento?.getAttribute('href')).toBe(`/operacion/documentos/${DOC_ID}`);
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);

    [...(aviso?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((b) => b.textContent?.trim() === 'Quitar filtro')!
      .click();
    const siguiente = pedido(http);
    expect(siguiente.request.params.has('document')).toBe(false);
    siguiente.flush(reporte([FIRMA]));
    await asentar(fixture);
    expect(root.querySelector('.bl__scope')).toBeNull();
  });

  it('filtrado por un documento sin fallos dice que nada coincide; sin permiso no enlaza al documento', async () => {
    const { root } = await montar(`/?documento=${DOC_ID}`, [], LECTOR);
    expect(root.textContent).toContain('Ningún fallo coincide con los filtros');
    expect(root.querySelector('.bl__scope')?.textContent).toContain(
      'Solo los fallos de un documento',
    );
    expect(root.querySelector('.bl__scope a')).toBeNull();
  });

  it('la vista arma los renglones del contexto aunque falten nombres', () => {
    expect(contextLinesOf(CONTEXTO)).toEqual([
      {
        key: 'document',
        section: 'documents',
        id: DOC_ID,
        title: 'NI-0004',
        detail: 'Contrato de arriendo',
        nit: null,
      },
      {
        key: 'signer',
        section: 'signers',
        id: FIRMANTE_ID,
        title: 'Ana Ruiz',
        detail: '1020304050',
        nit: null,
      },
      {
        key: 'organization',
        section: 'organizations',
        id: ORG_ID,
        title: 'Notaría Central',
        detail: null,
        nit: '900100001',
      },
    ]);
    expect(contextLinesOf({ document: { id: DOC_ID }, signer: { identityId: 'idn-9' } })).toEqual([
      { key: 'document', section: 'documents', id: DOC_ID, title: DOC_ID, detail: null, nit: null },
      { key: 'signer', section: 'signers', id: null, title: 'idn-9', detail: null, nit: null },
    ]);
    expect(contextLinesOf(undefined)).toEqual([]);
    expect(affectedOf(undefined)).toBeNull();
    expect(affectedOf({ documents: 0, capped: false })).toBeNull();
    expect(affectedOf({ documents: 1, capped: false })).toEqual({
      key: 'errl.affected.one',
      n: 1,
    });
    expect(affectedOf({ documents: 4, capped: false })).toEqual({
      key: 'errl.affected.many',
      n: 4,
    });
    expect(affectedOf({ documents: 500, capped: true })).toEqual({
      key: 'errl.affected.capped',
      n: 500,
    });
  });

  it('la vista traduce filtros, estados y acciones sin perder datos', () => {
    const filtros = filtersOf({
      estado: 'silenced',
      servicio: 'bridge',
      buscar: ' push ',
      periodo: '7d',
      documento: DOC_ID,
      grupo: ID,
      pagina: '4',
    });
    expect(filtros).toEqual({
      state: 'silenced',
      service: 'bridge',
      search: 'push',
      period: '7d',
      document: DOC_ID,
      group: ID,
      page: 4,
    });
    expect(queryParamsOf(filtros)).toEqual({
      estado: 'silenced',
      servicio: 'bridge',
      buscar: 'push',
      periodo: '7d',
      documento: DOC_ID,
      grupo: ID,
      pagina: 4,
    });
    expect(
      filtersOf({
        estado: 'otro',
        servicio: 'x',
        documento: 'NI-0004',
        grupo: 'no-es-id',
        pagina: '-1',
      }),
    ).toEqual({
      state: null,
      service: null,
      search: null,
      period: null,
      document: null,
      group: null,
      page: 1,
    });
    expect(statePills({ open: 3, resolved: 2, silenced: 1 })[0].count).toBe(6);
    expect(statePills({ open: 3, resolved: 2, silenced: 1 })[1].danger).toBe(true);
    expect(groupStateOf('open')).toBe('suspended');
    expect(stateActionsOf('open').map((a) => a.to)).toEqual(['resolved', 'silenced']);
    expect(stateActionsOf('silenced').map((a) => a.to)).toEqual(['open']);
    expect(actorPartsOf({ userId: 'u1', organizationId: 'o1' })).toEqual([
      { key: 'organizationId', value: 'o1' },
      { key: 'userId', value: 'u1' },
    ]);
  });
});
