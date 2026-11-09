import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type { HistorySignersPage, ValidationHistory } from '../data/validation-history.models';
import {
  LAST_LEGACY_DAY,
  historyAfterCutoff,
  historyFiltersOf,
  historyQueryParamsOf,
  historyRangeInvalid,
  historyRequestOf,
} from '../data/validation-history-view';
import { ValidationHistoryComponent } from './validation-history.component';

const LLAVE_CRUDA = /\b(vhis|vcon|vdet|nav|common|orgPicker)\.[a-zA-Z]/;
const RESELLER = '6af1a1a8f8bb442649c1d314';
const ALFA = '6af1a1a8f8bb442649c1d315';
const DIRECTA = '6af1a1a8f8bb442649c1d316';
const FIRMANTE = '6af1a1a8f8bb442649c1d320';
const BASE = '/inteligencia/historico-validaciones';
const REPORT = '/platform/validation-credits/history';

const cuentas = (ani: number, liveness: number, macherFacial = 0, otros = 0) => ({
  ani,
  liveness,
  macherFacial,
  otros,
  total: ani + liveness + macherFacial + otros,
});

const historico = (over: Partial<ValidationHistory> = {}): ValidationHistory => ({
  scope: { type: 'all', entity: null },
  cutoff: '2026-04-20T05:00:00.000Z',
  to: '2026-04-20T04:59:59.999Z',
  timeZone: 'America/Bogota',
  capped: false,
  totals: cuentas(2, 1, 1),
  signers: 2,
  groups: [
    {
      reseller: { id: RESELLER, businessName: 'Reseller Andino' },
      counts: cuentas(1, 1),
      signers: 1,
      billing: { currency: 'COP', lines: [], total: 10000 },
      pricing: { configured: true, mode: 'package', currency: 'COP' },
      organizations: [
        {
          organization: { id: ALFA, businessName: 'Alfa Inmobiliaria' },
          counts: cuentas(1, 1),
          signers: 1,
          billing: { currency: 'COP', lines: [], total: 10000 },
          pricing: { configured: true, mode: 'package', currency: 'COP' },
        },
      ],
    },
    {
      reseller: null,
      counts: cuentas(1, 0, 1),
      signers: 1,
      billing: null,
      pricing: null,
      organizations: [
        {
          organization: { id: DIRECTA, businessName: 'Directa SAS' },
          counts: cuentas(0, 0, 1),
          signers: 1,
          billing: null,
          pricing: null,
        },
        {
          organization: null,
          counts: cuentas(1, 0),
          signers: 1,
          billing: null,
          pricing: null,
        },
      ],
    },
  ],
  ...over,
});

const firmantes = (over: Partial<HistorySignersPage> = {}): HistorySignersPage => ({
  organization: { id: ALFA, businessName: 'Alfa Inmobiliaria' },
  total: 1,
  page: 1,
  limit: 20,
  items: [
    {
      id: FIRMANTE,
      name: 'Ana Pérez',
      identification: '1020304050',
      organizations: 2,
      counts: cuentas(1, 1),
      validations: [
        {
          type: 'ani',
          rawType: 'ani',
          date: '2026-03-01T15:00:00.000Z',
          result: 'passed',
          retry: false,
          copy: false,
        },
        {
          type: 'ani',
          rawType: 'ani',
          date: '2026-03-05T15:00:00.000Z',
          result: 'passed',
          retry: false,
          copy: true,
        },
        {
          type: 'liveness',
          rawType: 'liveness-previous-fail',
          date: '2026-03-01T16:00:00.000Z',
          result: 'failed',
          retry: true,
          copy: false,
        },
      ],
    },
  ],
  ...over,
});

describe('Histórico de validaciones: reglas de la vista', () => {
  it('lee los filtros de la URL y termina en el corte por defecto', () => {
    expect(historyFiltersOf({})).toEqual({
      resellerId: null,
      organizationId: null,
      from: null,
      to: LAST_LEGACY_DAY,
    });
    const filtros = historyFiltersOf({
      reseller: RESELLER,
      organizacion: ALFA,
      desde: '2026-01-01',
      hasta: 'ayer',
    });
    expect(filtros).toEqual({
      resellerId: null,
      organizationId: ALFA,
      from: '2026-01-01',
      to: LAST_LEGACY_DAY,
    });
    expect(historyQueryParamsOf(filtros)).toEqual({
      reseller: null,
      organizacion: ALFA,
      desde: '2026-01-01',
      hasta: null,
    });
    expect(historyQueryParamsOf({ ...filtros, to: '2026-02-01' })['hasta']).toBe('2026-02-01');
    expect(historyRangeInvalid({ ...filtros, to: '2025-12-01' })).toBe(true);
    expect(historyAfterCutoff({ ...filtros, from: '2026-05-01' })).toBe(true);
    const pedido = historyRequestOf({ ...filtros, from: null }, 'UTC');
    expect(pedido.organizationId).toBe(ALFA);
    expect(pedido.resellerId).toBeUndefined();
    expect(new Date(pedido.to!).getTime()).toBe(
      new Date(`${LAST_LEGACY_DAY}T23:59:59.999`).getTime(),
    );
  });
});

const montar = async (permisos: string[], url = BASE) => {
  const http = await configurar();
  conPermisos(permisos);
  TestBed.inject(Router).resetConfig([
    { path: 'inteligencia/historico-validaciones', component: ValidationHistoryComponent },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, ValidationHistoryComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(REPORT) && req.method === 'GET');

const pedidoFirmantes = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(`${REPORT}/signers`));

const asentar = async (harness: RouterTestingHarness): Promise<void> => {
  await harness.fixture.whenStable();
  harness.detectChanges();
};

const boton = (root: HTMLElement, etiqueta: string): HTMLButtonElement =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(etiqueta),
  )!;

describe('Histórico de validaciones', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('con solo Inteligencia muestra el árbol sin enlaces ni filtro de organización', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    const primero = pedido(http);
    expect(primero.request.params.has('from')).toBe(false);
    expect(primero.request.params.get('to')).toBeTruthy();
    expect(primero.request.params.get('tz')).toBeTruthy();
    primero.flush(historico());
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Histórico de validaciones');
    expect(texto).toContain('Reseller Andino');
    expect(texto).toContain('Firmantes: 1 · Validaciones: 2');
    expect(texto).toContain('Alfa Inmobiliaria');
    expect(texto).toContain('Sin reseller');
    expect(texto).toContain('Sin organización');
    expect(texto).toContain('Consultar Registraduría');
    expect(texto).not.toContain('Todas las organizaciones');
    expect(texto).not.toMatch(/\bANI\b/);
    expect(root.querySelectorAll('a.dba-ref')).toHaveLength(0);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('despliega una organización con sus firmantes y validaciones', async () => {
    const { harness, http, root } = await montar(['platform:intelligence', 'platform:clients']);
    pedido(http).flush(historico());
    await asentar(harness);

    boton(root, 'Ver los firmantes de Alfa Inmobiliaria').click();
    await asentar(harness);
    const lista = pedidoFirmantes(http);
    expect(lista.request.params.get('node')).toBe(ALFA);
    expect(lista.request.params.get('page')).toBe('1');
    lista.flush(firmantes());
    await asentar(harness);
    expect(root.textContent).toContain('Ana Pérez');
    expect(root.textContent).toContain('firmó en 2 organizaciones');

    boton(root, 'Ver las validaciones de Ana Pérez').click();
    await asentar(harness);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Copia · no cuenta');
    expect(texto).toContain('Reintento');
    expect(texto).toContain('Fallida');
    const enlaces = [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain(`/clientes/organizaciones/${ALFA}`);
    expect(enlaces).toContain(`/clientes/firmantes/${FIRMANTE}`);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('despliega a los firmantes sin organización con el nodo none', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    pedido(http).flush(historico());
    await asentar(harness);
    boton(root, 'Ver los firmantes de Sin organización').click();
    await asentar(harness);
    const lista = pedidoFirmantes(http);
    expect(lista.request.params.get('node')).toBe('none');
    lista.flush(firmantes({ organization: null, items: [] }));
    await asentar(harness);
    expect(root.textContent).toContain('Ningún firmante coincide con la búsqueda');
    http.verify();
  });

  it('el filtro de organización viaja al backend y a la URL', async () => {
    const { harness, http, root } = await montar(
      ['platform:intelligence'],
      `${BASE}?reseller=${RESELLER}&desde=2026-01-01&hasta=2026-02-28`,
    );
    http
      .expectOne((req) => req.url.endsWith(`/platform/intelligence/resellers/${RESELLER}`))
      .flush({ id: RESELLER, businessName: 'Reseller Andino', tributaryNumber: '900' });
    const primero = pedido(http);
    expect(primero.request.params.get('resellerId')).toBe(RESELLER);
    expect(primero.request.params.get('from')).toBeTruthy();
    primero.flush(historico({ groups: [], totals: cuentas(0, 0), signers: 0 }));
    await asentar(harness);
    expect(root.textContent).toContain('Sin validaciones en el periodo');
    expect(boton(root, 'Exportar CSV').disabled).toBe(true);
    expect(TestBed.inject(Router).url).toContain('hasta=2026-02-28');
    http.verify();
  });

  it('un desde posterior al corte no consulta', async () => {
    const { harness, http, root } = await montar(
      ['platform:intelligence'],
      `${BASE}?desde=2026-05-01`,
    );
    await asentar(harness);
    expect(root.textContent).toContain('El periodo empieza después del corte');
    http.verify();
  });

  it('exporta CSV y PDF con los mismos filtros', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    pedido(http).flush(historico({ capped: true }));
    await asentar(harness);
    expect(root.textContent).toContain('las cifras son parciales');

    boton(root, 'Exportar CSV').click();
    await asentar(harness);
    const csv = http.expectOne((req) => req.url.endsWith(`${REPORT}.csv`));
    expect(csv.request.params.get('to')).toBeTruthy();
    csv.flush(new Blob(['Reseller']));
    await asentar(harness);

    boton(root, 'Descargar PDF').click();
    await asentar(harness);
    const pdf = http.expectOne((req) => req.url.endsWith(`${REPORT}/pdf`) && req.method === 'POST');
    expect(pdf.request.body.tz).toBeTruthy();
    pdf.flush(new Blob(['%PDF']));
    await asentar(harness);
    http.verify();
  });

  it('si falla deja reintentar', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar el histórico');
    boton(root, 'Reintentar').click();
    await asentar(harness);
    pedido(http).flush(historico());
    await asentar(harness);
    expect(root.textContent).toContain('Alfa Inmobiliaria');
    http.verify();
  });
});
