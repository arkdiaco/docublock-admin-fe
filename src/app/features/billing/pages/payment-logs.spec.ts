import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import {
  failureText,
  filtersOf,
  logLabelKeyOf,
  logStateOf,
  okOf,
  queryParamsOf,
  resultPills,
} from '../data/payment-log-view';
import type { PaymentLogDetail, PaymentLogReport, PaymentLogRow } from '../data/payment-logs.models';
import {
  PAYMENT_LOGS_DEBOUNCE_MS,
  PAYMENT_LOGS_LIMIT,
  PaymentLogsComponent,
} from './payment-logs.component';

const LLAVE_CRUDA = /\b(plog|billing|nav|common)\.[a-zA-Z]/;
const BASE = '/platform/payment-logs';
const ORG = '6a979ef858233f68f8ba543a';

const FALLIDO: PaymentLogRow = {
  id: 'l1',
  direction: 'in',
  provider: 'stripe',
  stage: 'apply',
  operation: 'invoice.paid',
  eventId: 'evt_1',
  organizationId: ORG,
  organizationName: 'Org Uno',
  reference: 'sub_1',
  ok: false,
  outcome: null,
  error: { message: 'El plan no existe', code: 'PLAN_NOT_FOUND', status: 422 },
  durationMs: 41,
  at: '2026-11-17T22:00:00.000Z',
};

const RECHAZADO: PaymentLogRow = {
  id: 'l2',
  direction: 'in',
  provider: 'alohapay',
  stage: 'intake',
  operation: 'payment.completed',
  eventId: 'wh_1',
  organizationName: null,
  reference: 'pl_1',
  ok: true,
  outcome: 'unknown_link',
  durationMs: 1500,
  at: '2026-11-17T21:00:00.000Z',
};

const DETALLE: PaymentLogDetail = {
  ...FALLIDO,
  error: { ...FALLIDO.error!, stack: 'Error: El plan no existe\n    at apply' },
  request: { id: 'evt_1', type: 'invoice.paid' },
  response: { outcome: 'failed' },
};

const reporte = (items: PaymentLogRow[]): PaymentLogReport => ({
  total: items.length,
  page: 1,
  limit: PAYMENT_LOGS_LIMIT,
  items,
  totals: { all: 9, failed: 4 },
});

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET');

const limpiarBusquedas = (http: HttpTestingController): void => {
  http
    .match((req) => req.url.includes('/platform/organizations'))
    .forEach((req) => req.flush({ data: [] }));
};

const montar = async (url = '/', items = [FALLIDO, RECHAZADO]) => {
  const http = await configurar();
  conPermisos(['platform:commercial', 'platform:clients']);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(PaymentLogsComponent);
  const primero = pedido(http);
  primero.flush(reporte(items));
  limpiarBusquedas(http);
  await asentar(fixture);
  return { fixture, http, primero, root: fixture.nativeElement as HTMLElement };
};

describe('Bitácora de pagos', () => {
  it('lista los llamados con su origen, organización, referencia y error, sin llaves crudas', async () => {
    const { root, primero } = await montar();

    expect(primero.request.params.get('page')).toBe('1');
    expect(primero.request.params.get('limit')).toBe(String(PAYMENT_LOGS_LIMIT));
    expect(primero.request.params.has('ok')).toBe(false);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Bitácora');
    expect(texto).toContain('Aplicado en el core');
    expect(texto).toContain('Llegó al commons');
    expect(texto).toContain('Org Uno');
    expect(texto).toContain('Sin organización');
    expect(texto).toContain('422 · PLAN_NOT_FOUND · El plan no existe');
    expect(texto).toContain('Enlace desconocido');
    expect(texto).toContain('1.5 s');
    expect(texto).toContain('Con error');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('lee los filtros de la URL y los manda al core', async () => {
    const { primero } = await montar(
      `/?resultado=failed&proveedor=alohapay&etapa=intake&organizacion=${ORG}&buscar=pl_1&periodo=7d&pagina=2`,
    );

    const params = primero.request.params;
    expect(params.get('ok')).toBe('false');
    expect(params.get('provider')).toBe('alohapay');
    expect(params.get('stage')).toBe('intake');
    expect(params.get('organizationId')).toBe(ORG);
    expect(params.get('search')).toBe('pl_1');
    expect(params.get('page')).toBe('2');
    expect(Date.parse(params.get('from') ?? '')).toBeLessThan(Date.now() - 6 * 24 * 3_600_000);
  });

  it('la búsqueda espera a que se deje de escribir y vuelve a la primera página', async () => {
    const { root, http, fixture } = await montar('/?pagina=3');
    vi.useFakeTimers();
    try {
      const input = root.querySelector<HTMLInputElement>(
        'input[aria-label="Buscar por evento o referencia"]',
      );
      input!.value = ' evt_9 ';
      input!.dispatchEvent(new Event('input'));
      http.expectNone((req) => req.url.endsWith(BASE));
      vi.advanceTimersByTime(PAYMENT_LOGS_DEBOUNCE_MS);
    } finally {
      vi.useRealTimers();
    }
    const siguiente = pedido(http);
    expect(siguiente.request.params.get('search')).toBe('evt_9');
    expect(siguiente.request.params.get('page')).toBe('1');
    siguiente.flush(reporte([]));
    await asentar(fixture);
    expect(root.textContent).toContain('Ningún llamado coincide con estos filtros.');
  });

  it('abrir un llamado muestra el body, la respuesta y la traza del error', async () => {
    const { root, http, fixture } = await montar();
    root.querySelector<HTMLButtonElement>('button.dba-tr')!.click();
    http.expectOne((req) => req.url.endsWith(`${BASE}/l1`)).flush(DETALLE);
    await asentar(fixture);

    const modal = document.querySelector('dba-payment-log-detail');
    const texto = modal?.textContent ?? '';
    expect(texto).toContain('invoice.paid');
    expect(texto).toContain('"type": "invoice.paid"');
    expect(texto).toContain('"outcome": "failed"');
    expect(texto).toContain('Traza del error');
    expect(texto).toContain('at apply');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    const enlace = modal?.querySelector<HTMLAnchorElement>('a.item__link');
    expect(enlace?.getAttribute('href')).toContain(ORG);
  });

  it('si el core falla muestra el aviso y deja reintentar', async () => {
    const http = await configurar();
    conPermisos(['platform:commercial']);
    const fixture = TestBed.createComponent(PaymentLogsComponent);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No se pudo cargar la bitácora');
    root.querySelector<HTMLButtonElement>('.bl__panel button')!.click();
    pedido(http).flush(reporte([FALLIDO]));
    await asentar(fixture);
    expect(root.textContent).toContain('invoice.paid');
  });

  it('la vista traduce filtros, resultados y estados sin perder datos', () => {
    const filtros = filtersOf({
      resultado: 'ok',
      proveedor: 'wompi',
      etapa: 'call',
      organizacion: 'no-es-id',
      buscar: '  pl_1 ',
      periodo: '1y',
      pagina: '0',
    });
    expect(filtros).toEqual({
      result: 'ok',
      provider: null,
      stage: 'call',
      organizationId: null,
      search: 'pl_1',
      period: null,
      page: 1,
    });
    expect(queryParamsOf({ ...filtros, page: 4 })).toMatchObject({ resultado: 'ok', pagina: 4 });
    expect([okOf('ok'), okOf('failed'), okOf(null)]).toEqual([true, false, null]);
    expect(resultPills({ all: 9, failed: 4 }).map((pill) => pill.count)).toEqual([9, 5, 4]);
    expect(resultPills({ all: 9, failed: 4 })[2].danger).toBe(true);
    expect(logStateOf({ ok: false, outcome: 'applied' })).toBe('suspended');
    expect(logStateOf({ ok: true, outcome: 'duplicate' })).toBe('closed');
    expect(logLabelKeyOf({ ok: true, outcome: 'algo_nuevo' })).toBe('plog.result.ok');
    expect(failureText({ error: { message: 'caído' } })).toBe('caído');
  });
});
