import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NotificationService } from '../../../core/ui/notification.service';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { browserTimeZone } from '../../validation-consumption/data/detail-view';
import type {
  PlatformDocuments,
  PlatformOrganizationActivity,
} from '../data/platform-activity.models';
import type { PlatformOverview } from '../data/platform-analytics.models';
import { shareOf, yearOf, yearOptionsOf, yearQueryParamsOf } from '../data/platform-analytics-view';
import type { PlatformSignatures } from '../data/platform-signatures.models';
import { periodRangeOf, signatureFiltersOf, todayIn } from '../data/signature-filters';
import { PlatformAnalyticsComponent } from './platform-analytics.component';

const LLAVE_CRUDA = /\b(pan|nav|common)\.[a-zA-Z]/;
const BASE = '/inteligencia/analitica';
const OVERVIEW = '/platform/intelligence/overview';
const SIGNATURES = '/platform/intelligence/signatures';
const DOCUMENTS = '/platform/intelligence/documents';
const ORGANIZATIONS = '/platform/intelligence/organizations';
const SIGNATURES_CSV = '/platform/intelligence/signatures.csv';
const ORGANIZATIONS_CSV = '/platform/intelligence/organizations.csv';
const HORA = 3_600_000;

const documentos = (over: Partial<PlatformDocuments> = {}): PlatformDocuments => ({
  from: '2026-10-01',
  to: '2026-10-31',
  timeZone: 'America/Bogota',
  granularity: 'day',
  organizationId: null,
  channel: 'all',
  totals: { created: 120, completed: 80, averageCompletionMs: 52 * HORA },
  cohort: { completed: 60, inProgress: 40, rejected: 15, cancelled: 5 },
  previous: {
    created: 100,
    completed: 80,
    averageCompletionMs: 48 * HORA,
    from: '2026-08-31',
    to: '2026-09-30',
  },
  series: [
    { bucket: '2026-10-01', created: 4, completed: 2 },
    { bucket: '2026-10-02', created: 0, completed: 1 },
  ],
  ...over,
});

const sinDocumentos = (): PlatformDocuments =>
  documentos({
    totals: { created: 0, completed: 0, averageCompletionMs: null },
    cohort: { completed: 0, inProgress: 0, rejected: 0, cancelled: 0 },
    series: [],
  });

const organizaciones = (): PlatformOrganizationActivity => ({
  from: '2026-10-01',
  to: '2026-10-31',
  timeZone: 'America/Bogota',
  channel: 'all',
  active: 45,
  previous: { from: '2026-08-31', to: '2026-09-30', active: 41 },
  top: [
    {
      organizationId: '64b000000000000000000001',
      businessName: 'Inmobiliaria Andes',
      tributaryNumber: '900123456',
      signatures: 400,
      documents: 120,
      people: 95,
    },
  ],
});
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

const pedidoDocumentos = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(DOCUMENTS) && req.method === 'GET');

const pedidoOrganizaciones = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(ORGANIZATIONS) && req.method === 'GET');

const resto = (
  http: HttpTestingController,
  { vacio = false, conOrganizaciones = true } = {},
): void => {
  pedidoDocumentos(http).flush(vacio ? sinDocumentos() : documentos());
  if (conOrganizaciones) pedidoOrganizaciones(http).flush(organizaciones());
};

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
    resto(http);
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
    expect(root.querySelectorAll('dba-bar-chart')).toHaveLength(4);
    expect(texto).toContain('Profesional');
    expect(texto).toContain('75 % de las organizaciones activas');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('si falla deja reintentar', async () => {
    const { harness, http, root } = await montar(BASE);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    pedidoFirmas(http).flush(sinFirmas());
    resto(http, { vacio: true });
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
    resto(http);
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
    const conDocumentos = pedidoDocumentos(http);
    expect(conDocumentos.request.params.get('organizationId')).toBe(ORG);
    expect(conDocumentos.request.params.get('channel')).toBe('integration');
    conDocumentos.flush(documentos({ organizationId: ORG, channel: 'integration' }));
    http.expectNone((req) => req.url.endsWith(ORGANIZATIONS));
    await asentar(harness);
    expect(root.textContent).toContain('Elige «Todas las organizaciones» para ver las activas');
    expect(root.querySelectorAll('dba-field')).toHaveLength(2);
    expect(root.querySelector('dba-org-picker')).toBeNull();
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('cambiar el canal vuelve a pedir las firmas y lo deja en la URL sin perder el año', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    resto(http);
    await asentar(harness);

    botonCon(root, 'Plataforma').click();
    await asentar(harness);
    const conFirmas = pedidoFirmas(http);
    expect(conFirmas.request.params.get('channel')).toBe('platform');
    conFirmas.flush(firmas({ channel: 'platform' }));
    expect(pedidoDocumentos(http).request.params.get('channel')).toBe('platform');
    http.match((req) => req.url.endsWith(DOCUMENTS)).forEach((req) => req.flush(documentos()));
    const conOrganizaciones = pedidoOrganizaciones(http);
    expect(conOrganizaciones.request.params.get('channel')).toBe('platform');
    expect(conOrganizaciones.request.params.has('organizationId')).toBe(false);
    conOrganizaciones.flush(organizaciones());
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
    resto(http);
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
    http.expectNone((req) => req.url.endsWith(DOCUMENTS));
    http.expectNone((req) => req.url.endsWith(ORGANIZATIONS));
    expect(root.textContent).toContain('La fecha «Desde» va después de «Hasta».');
    http.verify();
  });

  it('si fallan las firmas deja reintentar sin tocar el resumen del año', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush({}, { status: 500, statusText: 'Error' });
    resto(http);
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar las firmas');
    expect(root.textContent).toContain('Documentos por mes · 2025');

    botonCon(root, 'Reintentar').click();
    pedidoFirmas(http).flush(firmas());
    await asentar(harness);
    expect(root.textContent).toContain('3,905');
    http.verify();
  });

  it('muestra documentos y organizaciones del período con su comparación', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    resto(http);
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Documentos creados');
    expect(texto).toContain('120');
    expect(texto).toContain('+20 %');
    expect(texto).toContain('Documentos completados');
    expect(texto).toContain('Tiempo medio para completar');
    expect(texto).toContain('2 d 4 h');
    expect(texto).toContain('Período anterior: 2 d 0 h');
    expect(texto).toContain('+8 %');
    expect(texto).toContain('Creados y completados por día');
    expect(texto).toContain('Cómo están hoy los creados en el período');
    expect(texto).toContain('Rechazados');
    expect(texto).toContain('12.5 % de los creados');
    expect(texto).toContain('Anulados o vencidos');
    expect(texto).toContain('Organizaciones activas');
    expect(texto).toContain('Período anterior: 41');
    expect(texto).toContain('Las 10 que más firmaron');
    expect(texto).toContain('Inmobiliaria Andes');
    expect(texto).toContain('900123456');
    expect(root.querySelector('dba-organizations-block a.dba-ref')).toBeNull();
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('un tiempo medio más largo que antes se marca como peor', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    resto(http);
    await asentar(harness);
    const tiempo = [...root.querySelectorAll('dba-documents-block .band__trend')].map(
      (el) => el.className,
    );
    expect(tiempo[2]).toContain('band__trend--down');
  });

  it('con permiso de clientes el top enlaza a la ficha de la organización', async () => {
    const { harness, http, root } = await montar(BASE, [
      'platform:intelligence',
      'platform:clients',
    ]);
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    resto(http);
    await asentar(harness);
    const enlace = root.querySelector<HTMLAnchorElement>('dba-organizations-block a.dba-ref');
    expect(enlace?.getAttribute('href')).toContain('64b000000000000000000001');
  });

  it('si fallan los documentos solo ese bloque deja reintentar', async () => {
    const { harness, http, root } = await montar();
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    pedidoDocumentos(http).flush({}, { status: 500, statusText: 'Error' });
    pedidoOrganizaciones(http).flush(organizaciones());
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar los documentos');
    expect(root.textContent).toContain('3,905');
    expect(root.textContent).toContain('Inmobiliaria Andes');

    botonCon(root, 'Reintentar').click();
    pedidoDocumentos(http).flush(documentos());
    await asentar(harness);
    expect(root.textContent).toContain('Documentos completados');
    http.verify();
  });
  it('exporta las firmas en CSV con los mismos filtros de la pantalla', async () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { harness, http, root } = await montar(
      `${BASE}?periodo=personalizado&desde=2018-01-01&hasta=2026-10-31&canal=plataforma&organizacion=${ORG}`,
    );
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas({ organizationId: ORG, channel: 'platform' }));
    resto(http, { conOrganizaciones: false });
    await asentar(harness);
    expect(botonCon(root, 'Exportar ranking')).toBeUndefined();

    botonCon(root, 'Exportar firmas').click();
    const csv = http.expectOne((req) => req.url.endsWith(SIGNATURES_CSV));
    expect(csv.request.params.get('from')).toBe('2018-01-01');
    expect(csv.request.params.get('to')).toBe('2026-10-31');
    expect(csv.request.params.get('channel')).toBe('platform');
    expect(csv.request.params.get('organizationId')).toBe(ORG);
    expect(csv.request.params.get('tz')).toBe(browserTimeZone());
    csv.flush(new Blob(['Fecha']), {
      headers: {
        'content-disposition': 'attachment; filename="firmas-2018-01-01-a-2026-10-31.csv"',
      },
    });
    await asentar(harness);
    expect(crear).toHaveBeenCalled();
    http.verify();
  });

  it('exporta el ranking de organizaciones del período en CSV', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const { harness, http, root } = await montar(
      `${BASE}?periodo=personalizado&desde=2026-10-01&hasta=2026-10-31`,
    );
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    resto(http);
    await asentar(harness);

    botonCon(root, 'Exportar ranking').click();
    const csv = http.expectOne((req) => req.url.endsWith(ORGANIZATIONS_CSV));
    expect(csv.request.params.get('from')).toBe('2026-10-01');
    expect(csv.request.params.get('to')).toBe('2026-10-31');
    expect(csv.request.params.get('channel')).toBe('all');
    expect(csv.request.params.has('organizationId')).toBe(false);
    csv.flush(new Blob(['Posición']));
    await asentar(harness);
    http.verify();
  });

  it('si la exportación falla lo avisa y deja volver a intentar', async () => {
    const { harness, http, root } = await montar();
    const fallo = vi.spyOn(TestBed.inject(NotificationService), 'error');
    pedido(http).flush(resumen());
    pedidoFirmas(http).flush(firmas());
    resto(http);
    await asentar(harness);

    botonCon(root, 'Exportar firmas').click();
    http
      .expectOne((req) => req.url.endsWith(SIGNATURES_CSV))
      .flush(new Blob(['x']), { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(fallo).toHaveBeenCalledWith('No pudimos exportar el CSV.');
    expect(botonCon(root, 'Exportar firmas').disabled).toBe(false);
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });
});
