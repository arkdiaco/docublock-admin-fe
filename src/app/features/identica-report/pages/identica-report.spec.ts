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
import type { IdenticaReportSummary } from '../data/identica-report.models';
import { IdenticaReportComponent } from './identica-report.component';

const LLAVE_CRUDA = /\b(ide|pan|nav|common)\.[a-zA-Z]/;
const BASE = '/inteligencia/consultas-identica';
const SUMMARY = '/platform/identica-report/summary';

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

const montar = async (url = BASE) => {
  const http = await configurar();
  conPermisos(['platform:intelligence']);
  TestBed.inject(Router).resetConfig([
    { path: 'inteligencia/consultas-identica', component: IdenticaReportComponent },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, IdenticaReportComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(SUMMARY) && req.method === 'GET');

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
    pedido(http).flush(resumen());
    await asentar(harness);

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
    http.verify();
  });

  it('sin consultas muestra el vacío, y si falla deja reintentar', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar el reporte');

    botonCon(root, 'Reintentar').click();
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
});
