import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import type { PlatformOverview } from '../data/platform-analytics.models';
import { shareOf, yearOf, yearOptionsOf, yearQueryParamsOf } from '../data/platform-analytics-view';
import type { PlatformSignatures } from '../data/platform-signatures.models';
import { periodRangeOf, signatureFiltersOf, todayIn } from '../data/signature-filters';
import { PlatformAnalyticsComponent } from './platform-analytics.component';

const LLAVE_CRUDA = /\b(pan|nav|common)\.[a-zA-Z]/;
const BASE = '/inteligencia/analitica';
const OVERVIEW = '/platform/intelligence/overview';
const SIGNATURES = '/platform/intelligence/signatures';
const ORG = '64b000000000000000000001';

const firmas = (over: Partial<PlatformSignatures> = {}): PlatformSignatures => ({
  from: '2026-10-01',
  to: '2026-10-31',
  timeZone: 'America/Bogota',
  granularity: 'day',
  organizationId: null,
  channel: 'all',
  totals: { signatures: 3905, people: 1240, newPeople: 310, documents: 2100, organizations: 45 },
  previous: {
    signatures: 3309,
    people: 1240,
    newPeople: 0,
    documents: 2200,
    organizations: 45,
    from: '2026-08-31',
    to: '2026-09-30',
  },
  series: [
    { bucket: '2026-10-01', signatures: 5, people: 3 },
    { bucket: '2026-10-02', signatures: 0, people: 0 },
  ],
  breakdown: {
    origin: { platform: 3200, integration: 700, other: 5 },
    mode: { manual: 3800, automatic: 105 },
    legalRep: 12,
    otp: { email: 2000, sms: 900, whatsapp: 800, passkey: 5, none: 200 },
    identity: { biometric: 300, registry: 150, none: 3455 },
  },
  ...over,
});

const sinFirmas = (): PlatformSignatures =>
  firmas({
    totals: { signatures: 0, people: 0, newPeople: 0, documents: 0, organizations: 0 },
    series: [],
  });

const resumen = (over: Partial<PlatformOverview> = {}): PlatformOverview => ({
  year: 2025,
  firstYear: 2023,
  timeZone: 'America/Bogota',
  users: 1200,
  organizations: { total: 90, clients: 85, resellers: 5 },
  documents: { created: 50000, signed: 41000 },
  transactions: { total: 310, approved: 280 },
  months: Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    documents: { created: index === 1 ? 7 : 0, signed: index === 1 ? 5 : 0 },
    transactions: { total: index === 2 ? 3 : 0, approved: index === 2 ? 2 : 0 },
  })),
  plans: [
    { code: 'PRO', name: 'Profesional', count: 3 },
    { code: null, name: 'Sin plan', count: 1 },
  ],
  ...over,
});

describe('Analítica de plataforma: reglas de la vista', () => {
  it('lee el año de la URL y descarta lo que no sirve', () => {
    expect(yearOf({ anio: '2024' }, 2026)).toBe(2024);
    expect(yearOf({ anio: '2030' }, 2026)).toBe(2026);
    expect(yearOf({ anio: 'ayer' }, 2026)).toBe(2026);
    expect(yearOf({}, 2026)).toBe(2026);
    expect(yearQueryParamsOf(2026, 2026)).toEqual({ anio: null });
    expect(yearQueryParamsOf(2024, 2026)).toEqual({ anio: 2024 });
  });

  it('ofrece los años desde el primero hasta el actual, el más reciente arriba', () => {
    expect(yearOptionsOf(2024, 2026, 2026).map((o) => o.id)).toEqual([2026, 2025, 2024]);
    expect(yearOptionsOf(2026, 2026, 2022).map((o) => o.id)).toEqual([
      2026, 2025, 2024, 2023, 2022,
    ]);
    expect(shareOf(3, 4)).toBe(75);
    expect(shareOf(1, 3)).toBe(33.3);
    expect(shareOf(0, 0)).toBe(0);
  });
});

const montar = async (url = `${BASE}?anio=2025`, permisos = ['platform:intelligence']) => {
  const http = await configurar();
  conPermisos(permisos);
  TestBed.inject(Router).resetConfig([
    { path: 'inteligencia/analitica', component: PlatformAnalyticsComponent },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, PlatformAnalyticsComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(OVERVIEW) && req.method === 'GET');

const pedidoFirmas = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(SIGNATURES) && req.method === 'GET');

const botonCon = (root: HTMLElement, texto: string): HTMLButtonElement =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    (b.textContent ?? '').includes(texto),
  )!;

const asentar = async (harness: RouterTestingHarness): Promise<void> => {
  await harness.fixture.whenStable();
  harness.detectChanges();
};

describe('Analítica de plataforma', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('pide el año de la URL y muestra cifras, gráficas y planes', async () => {
    const { harness, http, root } = await montar();
    const primero = pedido(http);
    expect(primero.request.params.get('year')).toBe('2025');
    expect(primero.request.params.get('tz')).toBeTruthy();
    primero.flush(resumen());
    const zona = browserTimeZone();
    const esperado = periodRangeOf(signatureFiltersOf({}), todayIn(new Date(), zona));
    const conFirmas = pedidoFirmas(http);
    expect(conFirmas.request.params.get('from')).toBe(esperado.from);
    expect(conFirmas.request.params.get('to')).toBe(esperado.to);
    expect(conFirmas.request.params.get('tz')).toBe(zona);
    expect(conFirmas.request.params.get('channel')).toBe('all');
    expect(conFirmas.request.params.has('organizationId')).toBe(false);
    conFirmas.flush(firmas());
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Usuarios');
    expect(texto).toContain('1,200');
    expect(texto).toContain('Organizaciones cliente');
    expect(texto).toContain('Resellers');
    expect(texto).toContain('Documentos creados en 2025');
    expect(texto).toContain('41,000 firmados');
    expect(texto).toContain('280 aprobadas');
    expect(texto).toContain('Transacciones por mes · 2025');
    expect(texto).toContain('Documentos por mes · 2025');
    expect(root.querySelectorAll('dba-bar-chart')).toHaveLength(3);
    expect(texto).toContain('Profesional');
    expect(texto).toContain('75 % de las organizaciones activas');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('si falla deja reintentar', async () => {
    const { harness, http, root } = await montar(BASE);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    pedidoFirmas(http).flush(sinFirmas());
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar la analítica');
    expect(root.textContent).toContain('Sin firmas en el período');

    botonCon(root, 'Reintentar').click();
    pedido(http).flush(resumen({ plans: [], transactions: { total: 0, approved: 0 } }));
    await asentar(harness);
    expect(root.textContent).toContain('Sin organizaciones activas');
    expect(root.textContent).toContain('Sin transacciones en el año');
    expect(root.querySelectorAll('dba-bar-chart')).toHaveLength(1);
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('muestra las firmas del período con su comparación y sus repartos', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Firmas');
    expect(texto).toContain('Oct 1, 2026 – Oct 31, 2026');
    expect(texto).toContain('3,905');
    expect(texto).toContain('+18 %');
    expect(texto).toContain('Período anterior: 3,309');
    expect(texto).toContain('Personas que firmaron');
    expect(texto).toContain('Personas nuevas');
    expect(texto).toContain('310');
    expect(texto).toContain('Documentos con firmas');
    expect(texto).toContain('−5 %');
    expect(texto).toContain('Firmas por día');
    expect(texto).toContain('Por dónde entró el documento');
    expect(texto).toContain('Integración');
    expect(texto).toContain('Otros');
    expect(texto).toContain('12 firmas como representante legal');
    expect(texto).toContain('Validación contra Registraduría');
    expect(texto).toContain('Passkey');
    expect(texto).not.toMatch(/padr[oó]n|\bANI\b/i);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('lee período, organización y canal de la URL y los manda al core', async () => {
    const { harness, http, root } = await montar(
      `${BASE}?periodo=personalizado&desde=2026-10-01&hasta=2026-10-31&canal=integracion&organizacion=${ORG}`,
    );
    pedido(http).flush(resumen());
    const conFirmas = pedidoFirmas(http);
    expect(conFirmas.request.params.get('from')).toBe('2026-10-01');
    expect(conFirmas.request.params.get('to')).toBe('2026-10-31');
    expect(conFirmas.request.params.get('channel')).toBe('integration');
    expect(conFirmas.request.params.get('organizationId')).toBe(ORG);
    conFirmas.flush(firmas({ channel: 'integration', organizationId: ORG }));
    await asentar(harness);
    expect(root.querySelectorAll('dba-field')).toHaveLength(2);
    expect(root.querySelector('dba-org-picker')).toBeNull();
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('cambiar el canal vuelve a pedir las firmas y lo deja en la URL sin perder el año', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    await asentar(harness);

    botonCon(root, 'Plataforma').click();
    await asentar(harness);
    const conFirmas = pedidoFirmas(http);
    expect(conFirmas.request.params.get('channel')).toBe('platform');
    conFirmas.flush(firmas({ channel: 'platform' }));
    await asentar(harness);
    const url = TestBed.inject(Router).url;
    expect(url).toContain('canal=plataforma');
    expect(url).toContain('anio=2025');
    http.verify();
  });

  it('con permiso de clientes deja elegir la organización', async () => {
    const { harness, http, root } = await montar(BASE, [
      'platform:intelligence',
      'platform:clients',
    ]);
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    await asentar(harness);
    expect(root.querySelector('dba-org-picker')).not.toBeNull();
  });

  it('un rango al revés avisa y no consulta', async () => {
    const { harness, http, root } = await montar(
      `${BASE}?periodo=personalizado&desde=2026-10-31&hasta=2026-10-01`,
    );
    pedido(http).flush(resumen());
    await asentar(harness);
    http.expectNone((req) => req.url.endsWith(SIGNATURES));
    expect(root.textContent).toContain('La fecha «Desde» va después de «Hasta».');
    http.verify();
  });

  it('si fallan las firmas deja reintentar sin tocar el resumen del año', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar las firmas');
    expect(root.textContent).toContain('Documentos por mes · 2025');

    botonCon(root, 'Reintentar').click();
    pedidoFirmas(http).flush(firmas());
    await asentar(harness);
    expect(root.textContent).toContain('3,905');
    http.verify();
  });
});
