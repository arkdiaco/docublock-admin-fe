import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type { SignedDocumentsReport } from '../data/reseller-documents.models';
import {
  signedFiltersOf,
  signedQueryParamsOf,
  signedRangeInvalid,
  signedRequestOf,
} from '../data/reseller-documents-view';
import { ResellerDocumentsComponent } from './reseller-documents.component';

const LLAVE_CRUDA = /\b(rdoc|vcon|nav|common|orgPicker)\.[a-zA-Z]/;
const RESELLER = '6af1a1a8f8bb442649c1d314';
const ALFA = '6af1a1a8f8bb442649c1d315';
const CERO = '6af1a1a8f8bb442649c1d317';
const BASE = '/inteligencia/documentos-reseller';
const REPORT = `/platform/resellers/${RESELLER}/signed-documents`;

const reporte = (over: Partial<SignedDocumentsReport> = {}): SignedDocumentsReport => ({
  reseller: { id: RESELLER, businessName: 'Reseller Andino' },
  total: 2,
  organizations: 2,
  organizationsWithSigned: 1,
  byOrganization: [
    { organizationId: ALFA, businessName: 'Alfa Inmobiliaria', count: 2 },
    { organizationId: CERO, businessName: 'Cero Movimiento', count: 0 },
  ],
  page: 1,
  limit: 20,
  exportCap: 50000,
  items: [
    {
      documentId: 'd1',
      name: 'Arriendo apto 301',
      code: 'AR-001',
      organization: { id: ALFA, name: 'Alfa Inmobiliaria' },
      signers: 2,
      signed: 2,
      signedAt: '2026-11-05T15:00:00.000Z',
    },
    {
      documentId: 'd2',
      name: 'Sin fecha',
      organization: { id: ALFA, name: 'Alfa Inmobiliaria' },
      signers: 1,
      signed: 0,
      signedAt: '2026-11-08T15:00:00.000Z',
    },
  ],
  ...over,
});

describe('Documentos por reseller: reglas de la vista', () => {
  it('lee reseller, periodo y página de la URL y descarta lo que no sirve', () => {
    const filtros = signedFiltersOf({
      reseller: RESELLER,
      desde: '2026-11-01',
      hasta: 'ayer',
      pagina: '2',
    });
    expect(filtros).toEqual({ resellerId: RESELLER, from: '2026-11-01', to: null, page: 2 });
    expect(signedFiltersOf({ reseller: 'x', pagina: '0' })).toEqual({
      resellerId: null,
      from: null,
      to: null,
      page: 1,
    });
    expect(signedQueryParamsOf({ ...filtros, page: 1 })).toEqual({
      reseller: RESELLER,
      desde: '2026-11-01',
      hasta: null,
      pagina: null,
    });
    expect(signedRangeInvalid({ ...filtros, to: '2026-10-01' })).toBe(true);
    const pedido = signedRequestOf({ ...filtros, to: '2026-11-30' }, 'UTC');
    expect(new Date(pedido.to!).getTime()).toBe(new Date('2026-11-30T23:59:59.999').getTime());
    expect(signedRequestOf(signedFiltersOf({}), 'UTC')).toEqual({ tz: 'UTC' });
  });
});

const montar = async (permisos: string[], url = `${BASE}?reseller=${RESELLER}`) => {
  const http = await configurar();
  conPermisos(permisos);
  TestBed.inject(Router).resetConfig([
    { path: 'inteligencia/documentos-reseller', component: ResellerDocumentsComponent },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, ResellerDocumentsComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(REPORT) && req.method === 'GET');

const resolverNombre = (http: HttpTestingController): void => {
  http
    .expectOne((req) => req.url.endsWith(`/platform/intelligence/resellers/${RESELLER}`))
    .flush({ id: RESELLER, businessName: 'Reseller Andino', tributaryNumber: '900' });
};

const asentar = async (harness: RouterTestingHarness): Promise<void> => {
  await harness.fixture.whenStable();
  harness.detectChanges();
};

const boton = (root: HTMLElement, etiqueta: string): HTMLButtonElement =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(etiqueta),
  )!;

describe('Documentos por reseller', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('sin reseller elegido no pide nada y lo explica', async () => {
    const { harness, http, root } = await montar(['platform:intelligence'], BASE);
    await asentar(harness);
    expect(root.textContent).toContain('Elige un reseller');
    expect(boton(root, 'Exportar CSV').disabled).toBe(true);
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('con solo Inteligencia muestra cifras, todas las organizaciones y los documentos sin enlaces', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    resolverNombre(http);
    const primero = pedido(http);
    expect(primero.request.params.get('page')).toBe('1');
    expect(primero.request.params.get('limit')).toBe('20');
    expect(primero.request.params.get('tz')).toBeTruthy();
    primero.flush(reporte());
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Reseller Andino');
    expect(texto).toContain('Documentos firmados');
    expect(texto).toContain('Con documentos firmados');
    expect(texto).toContain('Resumen por organización');
    expect(texto).toContain('Cero Movimiento');
    expect(texto).toContain('AR-001');
    expect(texto).toContain('Sin código');
    expect(texto).toContain('2 / 2');
    expect(texto).toContain('0 / 1');
    expect(root.querySelectorAll('a.dba-ref')).toHaveLength(0);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('con Operación y Clientes enlaza documentos y organizaciones', async () => {
    const { harness, http, root } = await montar([
      'platform:intelligence',
      'platform:operations',
      'platform:clients',
    ]);
    resolverNombre(http);
    pedido(http).flush(reporte());
    await asentar(harness);
    const enlaces = [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/operacion/documentos/d1');
    expect(enlaces).toContain(`/clientes/organizaciones/${ALFA}`);
    expect(enlaces).toContain(`/clientes/organizaciones/${CERO}`);
    http.verify();
  });

  it('el periodo y la página viajan al backend y a la URL', async () => {
    const { harness, http, root } = await montar(
      ['platform:intelligence'],
      `${BASE}?reseller=${RESELLER}&desde=2026-11-01`,
    );
    resolverNombre(http);
    const primero = pedido(http);
    expect(primero.request.params.get('from')).toBeTruthy();
    expect(primero.request.params.has('to')).toBe(false);
    primero.flush(reporte({ total: 45 }));
    await asentar(harness);
    expect(root.textContent).toContain('1–2 de 45');

    boton(root, 'Página siguiente').click();
    await asentar(harness);
    const siguiente = pedido(http);
    expect(siguiente.request.params.get('page')).toBe('2');
    siguiente.flush(reporte({ total: 45, page: 2 }));
    await asentar(harness);
    expect(TestBed.inject(Router).url).toContain('pagina=2');
    expect(TestBed.inject(Router).url).toContain(`reseller=${RESELLER}`);
    http.verify();
  });

  it('exporta CSV y PDF con el mismo periodo', async () => {
    const { harness, http, root } = await montar(
      ['platform:intelligence'],
      `${BASE}?reseller=${RESELLER}&hasta=2026-11-30`,
    );
    resolverNombre(http);
    pedido(http).flush(reporte({ total: 60000 }));
    await asentar(harness);
    expect(root.textContent).toContain('El CSV trae los primeros 50,000 documentos');

    boton(root, 'Exportar CSV').click();
    await asentar(harness);
    const csv = http.expectOne((req) => req.url.endsWith(`${REPORT}.csv`));
    expect(csv.request.params.get('to')).toBeTruthy();
    expect(csv.request.params.has('page')).toBe(false);
    csv.flush(new Blob(['Documento']));
    await asentar(harness);

    boton(root, 'Descargar PDF').click();
    await asentar(harness);
    const pdf = http.expectOne((req) => req.url.endsWith(`${REPORT}/pdf`) && req.method === 'POST');
    expect(pdf.request.body.to).toBeTruthy();
    expect(pdf.request.body.tz).toBeTruthy();
    pdf.flush(new Blob(['%PDF']));
    await asentar(harness);
    http.verify();
  });

  it('un reseller que ya no lo es se ve como no encontrado', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    resolverNombre(http);
    pedido(http).flush({ code: 'NO_ES_RESELLER' }, { status: 400, statusText: 'Bad Request' });
    await asentar(harness);
    expect(root.textContent).toContain('No encontramos este reseller');
    http.verify();
  });

  it('si falla deja reintentar', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    resolverNombre(http);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar los documentos');
    boton(root, 'Reintentar').click();
    await asentar(harness);
    pedido(http).flush(reporte());
    await asentar(harness);
    expect(root.textContent).toContain('Arriendo apto 301');
    http.verify();
  });
});
