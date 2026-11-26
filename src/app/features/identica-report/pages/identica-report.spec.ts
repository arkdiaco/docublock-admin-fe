import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import {
  periodRangeOf,
  signatureFiltersOf,
  todayIn,
} from '../../platform-analytics/data/signature-filters';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import type {
  IdenticaQueriesPage,
  IdenticaQueryItem,
  IdenticaReportSummary,
} from '../data/identica-report.models';
import { IdenticaReportComponent } from './identica-report.component';

const LLAVE_CRUDA = /\b(ide|pan|nav|common)\.[a-zA-Z]/;
const BASE = '/inteligencia/consultas-identica';
const SUMMARY = '/platform/identica-report/summary';
const QUERIES = '/platform/identica-report/queries';
const CSV = '/platform/identica-report/queries.csv';
const INTELIGENCIA = ['platform:intelligence'];

const ceros = { total: 0, identica: 0, review: 0, docublock: 0, ok: 0 };

const resumen = (over: Partial<IdenticaReportSummary> = {}): IdenticaReportSummary => ({
  from: '2026-10-01',
  to: '2026-11-30',
  timeZone: 'America/Bogota',
  totals: { total: 200, identica: 30, review: 10, docublock: 5, ok: 155 },
  categories: [
    { category: 'identica_server_error', group: 'identica', count: 20 },
    { category: 'identica_no_response', group: 'identica', count: 10 },
    { category: 'access_denied', group: 'review', count: 10 },
    { category: 'request_rejected', group: 'docublock', count: 5 },
    { category: 'approved', group: 'ok', count: 150 },
    { category: 'negative', group: 'ok', count: 5 },
  ],
  services: [
    { service: 'ani', total: 120, identica: 25, review: 0, docublock: 5, ok: 90 },
    { service: 'matcher-facial', total: 60, identica: 5, review: 0, docublock: 0, ok: 55 },
    { service: 'liveness', ...ceros },
    { service: 'auth', total: 20, identica: 0, review: 10, docublock: 0, ok: 10 },
  ],
  months: [
    { month: '2026-10', total: 80, identica: 10, review: 5, docublock: 0, ok: 65 },
    { month: '2026-11', total: 120, identica: 20, review: 5, docublock: 5, ok: 90 },
  ],
  reasons: [
    {
      service: 'ani',
      category: 'identica_server_error',
      group: 'identica',
      httpStatus: 503,
      responseCode: null,
      message: 'Request failed with status code 503',
      count: 20,
    },
    {
      service: 'auth',
      category: 'access_denied',
      group: 'review',
      httpStatus: 401,
      responseCode: null,
      message: null,
      count: 10,
    },
  ],
  ...over,
});

const CONSULTA: IdenticaQueryItem = {
  id: 'l1',
  occurredAt: '2026-11-03T15:00:00.000Z',
  service: 'ani',
  serviceId: '5',
  category: 'identica_server_error',
  group: 'identica',
  httpStatus: 503,
  responseCode: 'TRANS500',
  message: 'Intente más tarde',
  durationMs: 1200,
  document: { id: 'd1', code: 'NI-0004', name: 'Contrato de arriendo' },
  organization: { id: 'o1', name: 'Inmobiliaria Norte', tributaryNumber: '900100200' },
  signer: { id: 's1', name: 'Ana Pérez', identification: '1020304050' },
};

const SIN_REFERENCIAS: IdenticaQueryItem = {
  ...CONSULTA,
  id: 'l2',
  service: 'auth',
  serviceId: null,
  category: 'access_denied',
  group: 'review',
  httpStatus: 401,
  responseCode: null,
  message: null,
  durationMs: 850,
  document: null,
  organization: null,
  signer: null,
};

const lista = (
  items: IdenticaQueryItem[] = [CONSULTA, SIN_REFERENCIAS],
  over: Partial<IdenticaQueriesPage> = {},
): IdenticaQueriesPage => ({
  from: '2026-10-28',
  to: '2026-11-26',
  timeZone: 'America/Bogota',
  page: 1,
  limit: 20,
  total: items.length,
  items,
  ...over,
});

const montar = async (url = BASE, permisos = INTELIGENCIA) => {
  const http = await configurar();
  conPermisos(permisos);
  TestBed.inject(Router).resetConfig([
    { path: 'inteligencia/consultas-identica', component: IdenticaReportComponent },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, IdenticaReportComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(SUMMARY) && req.method === 'GET');

const pedidoLista = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(QUERIES) && req.method === 'GET');

const responder = async (
  harness: RouterTestingHarness,
  http: HttpTestingController,
  datos: IdenticaReportSummary = resumen(),
  consultas: IdenticaQueriesPage = lista(),
): Promise<void> => {
  pedido(http).flush(datos);
  pedidoLista(http).flush(consultas);
  await asentar(harness);
};

const asentar = async (harness: RouterTestingHarness): Promise<void> => {
  await harness.fixture.whenStable();
  harness.detectChanges();
};

const botonCon = (root: HTMLElement, texto: string): HTMLButtonElement =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    (b.textContent ?? '').includes(texto),
  )!;

describe('Consultas a Identica', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('pide los últimos 30 días y muestra los grupos con su porcentaje', async () => {
    const { harness, http, root } = await montar();
    const zona = browserTimeZone();
    const esperado = periodRangeOf(signatureFiltersOf({}), todayIn(new Date(), zona));
    const primero = pedido(http);
    expect(primero.request.params.get('from')).toBe(esperado.from);
    expect(primero.request.params.get('to')).toBe(esperado.to);
    expect(primero.request.params.get('tz')).toBe(zona);
    primero.flush(resumen());
    pedidoLista(http).flush(lista());
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Consultas a Identica');
    expect(texto).toContain('Error de Identica');
    expect(texto).toContain('15 % del total');
    expect(texto).toContain('Para revisar');
    expect(texto).toContain('5 % del total');
    expect(texto).toContain('De Docublock');
    expect(texto).toContain('2.5 % del total');
    expect(texto).toContain('Sin error');
    expect(texto).toContain('77.5 % del total');
    expect(texto).toContain('las consultas que hace el commons no quedan en este registro');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('muestra clasificaciones, meses, servicios y motivos con sus nombres', async () => {
    const { harness, http, root } = await montar();
    await responder(harness, http);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Error de su servidor (5xx, 408 o 429)');
    expect(texto).toContain('No respondió (tiempo agotado o conexión caída)');
    expect(root.querySelectorAll('dba-bar-chart')).toHaveLength(1);
    expect(texto).toContain('Validación contra Registraduría');
    expect(texto).toContain('Cotejo facial');
    expect(texto).toContain('Prueba de vida');
    expect(texto).toContain('Inicio de sesión en Identica');
    expect(texto).toContain('20.8 %');
    expect(texto).toContain('Request failed with status code 503');
    expect(texto).toContain('Sin mensaje');
    expect(texto).toContain('Acceso negado (401 o 403)');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('el período personalizado va en la URL y en el pedido', async () => {
    const { harness, http } = await montar(
      `${BASE}?periodo=personalizado&desde=2026-11-01&hasta=2026-11-05`,
    );
    const primero = pedido(http);
    expect(primero.request.params.get('from')).toBe('2026-11-01');
    expect(primero.request.params.get('to')).toBe('2026-11-05');
    primero.flush(resumen());
    const consultas = pedidoLista(http);
    expect(consultas.request.params.get('from')).toBe('2026-11-01');
    expect(consultas.request.params.get('to')).toBe('2026-11-05');
    consultas.flush(lista());
    await asentar(harness);
    http.verify();
  });

  it('con el período al revés avisa y no pide nada', async () => {
    const { harness, http, root } = await montar(
      `${BASE}?periodo=personalizado&desde=2026-11-05&hasta=2026-11-01`,
    );
    await asentar(harness);
    expect(root.textContent).toContain('La fecha «Desde» va después de «Hasta».');
    http.expectNone((req) => req.url.endsWith(SUMMARY));
    http.expectNone((req) => req.url.endsWith(QUERIES));
    http.verify();
  });

  it('sin consultas muestra el vacío, y si falla deja reintentar', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    pedidoLista(http).flush(lista([]));
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar el reporte');

    botonCon(root, 'Reintentar').click();
    pedidoLista(http).flush(lista([]));
    pedido(http).flush(
      resumen({
        totals: ceros,
        categories: [],
        services: [],
        months: [],
        reasons: [],
      }),
    );
    await asentar(harness);
    expect(root.textContent).toContain('Sin consultas en el período');
    expect(root.querySelectorAll('dba-bar-chart')).toHaveLength(0);
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });
  it('lista lo que no salió bien con documento, organización y firmante, sin enlaces si no ve esas secciones', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    const consultas = pedidoLista(http);
    expect(consultas.request.params.get('page')).toBe('1');
    expect(consultas.request.params.get('limit')).toBe('20');
    expect(consultas.request.params.has('group')).toBe(false);
    consultas.flush(lista());
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Consultas con error o para revisar');
    expect(texto).toContain('TRANS500');
    expect(texto).toContain('Intente más tarde');
    expect(texto).toContain('1.2 s');
    expect(texto).toContain('850 ms');
    expect(texto).toContain('NI-0004');
    expect(texto).toContain('Contrato de arriendo');
    expect(texto).toContain('Inmobiliaria Norte');
    expect(texto).toContain('NIT 900100200');
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('1020304050');
    expect(texto).toContain('Sin documento');
    expect(texto).toContain('Sin firmante');
    expect(root.querySelector('a[href^="/operacion/documentos/"]')).toBeNull();
    expect(root.querySelector('a[href^="/clientes/organizaciones/"]')).toBeNull();
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('con lectura de Operación y Clientes enlaza el documento y la organización', async () => {
    const { harness, http, root } = await montar(BASE, [
      'platform:intelligence',
      'platform:operations',
      'platform:clients',
    ]);
    await responder(harness, http);

    expect(root.querySelector('a[href="/operacion/documentos/d1"]')?.textContent).toContain(
      'NI-0004',
    );
    expect(root.querySelector('a[href="/clientes/organizaciones/o1"]')?.textContent).toContain(
      'Inmobiliaria Norte',
    );
    http.verify();
  });

  it('los filtros de la URL van al pedido y la página siguiente los conserva sin pedir el resumen', async () => {
    const { harness, http, root } = await montar(`${BASE}?grupo=identica&servicio=ani`);
    pedido(http).flush(resumen());
    const primera = pedidoLista(http);
    expect(primera.request.params.get('group')).toBe('identica');
    expect(primera.request.params.get('service')).toBe('ani');
    primera.flush(lista([CONSULTA], { total: 45 }));
    await asentar(harness);
    expect(root.textContent).toContain('1–20 de 45');

    root.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.click();
    const segunda = pedidoLista(http);
    expect(segunda.request.params.get('page')).toBe('2');
    expect(segunda.request.params.get('group')).toBe('identica');
    segunda.flush(lista([CONSULTA], { total: 45, page: 2 }));
    await asentar(harness);
    http.expectNone((req) => req.url.endsWith(SUMMARY));
    expect(TestBed.inject(Router).url).toContain('pagina=2');
    http.verify();
  });

  it('elegir un grupo pide la lista desde la primera página y lo guarda en la URL', async () => {
    const { harness, http, root } = await montar(`${BASE}?pagina=3`);
    await responder(harness, http);

    const pastilla = [...root.querySelectorAll<HTMLButtonElement>('db-filter-pills button')].find(
      (b) => (b.textContent ?? '').includes('Para revisar'),
    )!;
    expect(pastilla.textContent).toContain('10');
    pastilla.click();
    const filtrada = pedidoLista(http);
    expect(filtrada.request.params.get('group')).toBe('review');
    expect(filtrada.request.params.get('page')).toBe('1');
    filtrada.flush(lista([]));
    await asentar(harness);
    expect(root.textContent).toContain('Ninguna consulta coincide con el filtro');
    expect(TestBed.inject(Router).url).toContain('grupo=review');
    expect(TestBed.inject(Router).url).not.toContain('pagina=');
    http.verify();
  });

  it('el CSV baja con el período y los filtros, sin página', async () => {
    const { harness, http, root } = await montar(`${BASE}?grupo=identica&pagina=2`);
    await responder(harness, http, resumen(), lista([CONSULTA], { total: 25, page: 2 }));

    botonCon(root, 'Descargar CSV').click();
    const csv = http.expectOne((req) => req.url.endsWith(CSV));
    expect(csv.request.params.get('group')).toBe('identica');
    expect(csv.request.params.get('from')).toBeTruthy();
    expect(csv.request.params.has('page')).toBe(false);
    expect(csv.request.params.has('limit')).toBe(false);
    csv.flush(new Blob(['Fecha']), {
      headers: {
        'Content-Disposition':
          'attachment; filename="consultas-identica-2026-10-28-a-2026-11-26.csv"',
      },
    });
    await asentar(harness);
    http.verify();
  });

  it('si la lista falla deja reintentar solo la lista, y sin errores muestra el vacío', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoLista(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar la lista de consultas');

    botonCon(root, 'Reintentar').click();
    pedidoLista(http).flush(lista([]));
    await asentar(harness);
    http.expectNone((req) => req.url.endsWith(SUMMARY));
    expect(root.textContent).toContain('Ninguna consulta con error en el período');
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });
});
