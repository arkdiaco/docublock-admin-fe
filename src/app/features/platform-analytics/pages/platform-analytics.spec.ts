import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type { PlatformOverview } from '../data/platform-analytics.models';
import { shareOf, yearOf, yearOptionsOf, yearQueryParamsOf } from '../data/platform-analytics-view';
import { PlatformAnalyticsComponent } from './platform-analytics.component';

const LLAVE_CRUDA = /\b(pan|nav|common)\.[a-zA-Z]/;
const BASE = '/inteligencia/analitica';
const OVERVIEW = '/platform/intelligence/overview';

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

const montar = async (url = `${BASE}?anio=2025`) => {
  const http = await configurar();
  conPermisos(['platform:intelligence']);
  TestBed.inject(Router).resetConfig([
    { path: 'inteligencia/analitica', component: PlatformAnalyticsComponent },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, PlatformAnalyticsComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(OVERVIEW) && req.method === 'GET');

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
    expect(root.querySelectorAll('dba-bar-chart')).toHaveLength(2);
    expect(texto).toContain('Profesional');
    expect(texto).toContain('75 % de las organizaciones activas');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('si falla deja reintentar', async () => {
    const { harness, http, root } = await montar(BASE);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar la analítica');

    const reintentar = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      (b.textContent ?? '').includes('Reintentar'),
    )!;
    reintentar.click();
    pedido(http).flush(resumen({ plans: [], transactions: { total: 0, approved: 0 } }));
    await asentar(harness);
    expect(root.textContent).toContain('Sin organizaciones activas');
    expect(root.textContent).toContain('Sin transacciones en el año');
    expect(root.querySelectorAll('dba-bar-chart')).toHaveLength(1);
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });
});
