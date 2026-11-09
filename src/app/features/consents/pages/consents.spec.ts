import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type { ConsentItem, ConsentReport } from '../data/consents.models';
import {
  consentFiltersOf,
  consentQueryParamsOf,
  consentRangeInvalid,
  consentRequestOf,
} from '../data/consents-view';
import { ConsentsComponent } from './consents.component';

const LLAVE_CRUDA = /\b(cns|vcon|nav|common|orgPicker)\.[a-zA-Z]/;
const REPORT = '/platform/consents';
const ORG = '6af19db5a102f20c0c117c52';
const BASE = '/inteligencia/tratamiento-datos';

const CATALOGO: ConsentItem = {
  documentId: 'd1',
  documentName: 'Contrato de arriendo',
  documentCode: 'CA-001',
  organization: { id: ORG, name: 'Inmobiliaria Norte' },
  signer: { identityId: 'i1', signerId: 's1', name: 'Ana Pérez', identification: '900100200' },
  acceptedAt: '2026-11-03T15:00:00.000Z',
  source: 'catalog',
  policy: { id: 'p2', code: 'HABEAS', version: 2, title: 'Autorización de tratamiento' },
  ip: '10.4.0.1',
};

const ANTERIOR: ConsentItem = {
  documentId: 'd2',
  documentName: 'Promesa',
  organization: { id: ORG },
  signer: { identityId: 'i2', name: 'Firmante sin nombre' },
  acceptedAt: '2026-11-02T15:00:00.000Z',
  source: 'legacy',
  policy: { legacyVersion: '1.0' },
};

const reporte = (over: Partial<ConsentReport> = {}): ConsentReport => ({
  total: 2,
  signers: 2,
  organizations: 1,
  page: 1,
  limit: 20,
  exportCap: 50000,
  items: [CATALOGO, ANTERIOR],
  policies: {
    catalog: [
      {
        value: 'HABEAS@2',
        code: 'HABEAS',
        version: 2,
        title: 'Autorización de tratamiento',
        count: 1,
      },
    ],
    legacy: 1,
  },
  ...over,
});

describe('Tratamiento de datos: reglas de la vista', () => {
  it('lee los filtros de la URL y descarta lo que no sirve', () => {
    const filtros = consentFiltersOf({
      desde: '2026-11-01',
      hasta: '2026-13-40',
      organizacion: ORG,
      politica: 'HABEAS@2',
      buscar: 'ana',
      pagina: '3',
    });
    expect(filtros).toEqual({
      from: '2026-11-01',
      to: null,
      organizationId: ORG,
      policy: 'HABEAS@2',
      search: 'ana',
      page: 3,
    });
    expect(consentFiltersOf({ organizacion: 'x', politica: '$where', pagina: '-1' })).toMatchObject(
      { organizationId: null, policy: '', page: 1 },
    );
    expect(consentQueryParamsOf({ ...filtros, search: '  ', page: 1 })).toEqual({
      desde: '2026-11-01',
      hasta: null,
      organizacion: ORG,
      politica: 'HABEAS@2',
      buscar: null,
      pagina: null,
    });
    expect(consentRangeInvalid({ ...filtros, to: '2026-10-01' })).toBe(true);
  });

  it('arma el pedido con el último día incluido y sin campos vacíos', () => {
    const pedido = consentRequestOf(
      consentFiltersOf({ desde: '2026-11-01', hasta: '2026-11-30', politica: 'anterior' }),
      'America/Bogota',
    );
    expect(new Date(pedido.from!).getTime()).toBe(new Date('2026-11-01T00:00:00').getTime());
    expect(new Date(pedido.to!).getTime()).toBe(new Date('2026-11-30T23:59:59.999').getTime());
    expect(pedido).toMatchObject({ policy: 'anterior', tz: 'America/Bogota' });
    expect(consentRequestOf(consentFiltersOf({}), 'UTC')).toEqual({ tz: 'UTC' });
  });
});

const montar = async (permisos: string[], url = BASE) => {
  const http = await configurar();
  conPermisos(permisos);
  TestBed.inject(Router).resetConfig([
    { path: 'inteligencia/tratamiento-datos', component: ConsentsComponent },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, ConsentsComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(REPORT) && req.method === 'GET');

const asentar = async (harness: RouterTestingHarness): Promise<void> => {
  await harness.fixture.whenStable();
  harness.detectChanges();
};

const boton = (root: HTMLElement, etiqueta: string): HTMLButtonElement =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(etiqueta),
  )!;

describe('Tratamiento de datos', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('con solo Inteligencia muestra cifras, aceptaciones de ambas fuentes y ningún enlace', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    const primero = pedido(http);
    expect(primero.request.params.get('page')).toBe('1');
    expect(primero.request.params.get('limit')).toBe('20');
    expect(primero.request.params.get('tz')).toBeTruthy();
    primero.flush(reporte());
    await asentar(harness);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Aceptaciones');
    expect(texto).toContain('Firmantes distintos');
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('900100200');
    expect(texto).toContain('CA-001');
    expect(texto).toContain('Autorización de tratamiento');
    expect(texto).toContain('HABEAS · Versión 2');
    expect(texto).toContain('Aceptación anterior al catálogo');
    expect(texto).toContain('Versión registrada 1.0');
    expect(texto).toContain('Sin identificación');
    expect(texto).toContain('Sin código');
    expect(texto).toContain('Organización sin nombre');
    expect(root.querySelectorAll('a.dba-ref')).toHaveLength(0);
    expect(root.querySelector('dba-org-picker')).toBeNull();
    expect(texto).not.toMatch(/\bANI\b/);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('con Operación y Clientes enlaza documento, firmante y organización y deja filtrar por organización', async () => {
    const { harness, http, root } = await montar([
      'platform:intelligence',
      'platform:operations',
      'platform:clients',
    ]);
    pedido(http).flush(reporte());
    await asentar(harness);
    const enlaces = [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/operacion/documentos/d1');
    expect(enlaces).toContain('/clientes/firmantes/s1');
    expect(enlaces).toContain(`/clientes/organizaciones/${ORG}`);
    expect(enlaces.filter((h) => h === '/clientes/firmantes/undefined')).toHaveLength(0);
    expect(root.querySelector('dba-org-picker')).not.toBeNull();
    http.verify();
  });

  it('la política de la URL, la búsqueda y la página viajan al backend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { harness, http, root } = await montar(
        ['platform:intelligence'],
        `${BASE}?politica=anterior&organizacion=${ORG}`,
      );
      const primero = pedido(http);
      expect(primero.request.params.get('policy')).toBe('anterior');
      expect(primero.request.params.get('organizationId')).toBe(ORG);
      primero.flush(reporte({ total: 45 }));
      await asentar(harness);
      expect(root.textContent).toContain('1–2 de 45');

      const buscar = root.querySelector<HTMLInputElement>('input[type="search"]')!;
      buscar.value = '900100200';
      buscar.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(400);
      await asentar(harness);
      const porBusqueda = pedido(http);
      expect(porBusqueda.request.params.get('search')).toBe('900100200');
      expect(porBusqueda.request.params.get('policy')).toBe('anterior');
      porBusqueda.flush(reporte({ total: 45 }));
      await asentar(harness);

      boton(root, 'Página siguiente').click();
      await asentar(harness);
      const siguiente = pedido(http);
      expect(siguiente.request.params.get('page')).toBe('2');
      expect(siguiente.request.params.get('search')).toBe('900100200');
      siguiente.flush(reporte({ total: 45, page: 2 }));
      await asentar(harness);
      expect(TestBed.inject(Router).url).toContain('pagina=2');
      expect(TestBed.inject(Router).url).toContain('buscar=900100200');
      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });

  it('exporta el CSV con los mismos filtros y avisa del tope', async () => {
    const { harness, http, root } = await montar(
      ['platform:intelligence'],
      `${BASE}?desde=2026-11-01&politica=HABEAS%402`,
    );
    pedido(http).flush(reporte({ total: 60000 }));
    await asentar(harness);
    expect(root.textContent).toContain('El CSV trae las primeras 50,000 aceptaciones');

    boton(root, 'Exportar CSV').click();
    await asentar(harness);
    const csv = http.expectOne((req) => req.url.endsWith(`${REPORT}/export.csv`));
    expect(csv.request.params.get('policy')).toBe('HABEAS@2');
    expect(csv.request.params.get('from')).toBeTruthy();
    expect(csv.request.params.has('page')).toBe(false);
    csv.flush(new Blob(['Fecha']), {
      headers: { 'Content-Disposition': 'attachment; filename="tratamiento-datos.csv"' },
    });
    await asentar(harness);
    http.verify();
  });

  it('sin aceptaciones con filtros lo dice y no deja exportar', async () => {
    const { harness, http, root } = await montar(['platform:intelligence'], `${BASE}?buscar=nadie`);
    pedido(http).flush(reporte({ total: 0, signers: 0, organizations: 0, items: [] }));
    await asentar(harness);
    expect(root.textContent).toContain('Ninguna aceptación coincide');
    expect(boton(root, 'Exportar CSV').disabled).toBe(true);
    http.verify();
  });

  it('si el reporte falla muestra el error y reintenta', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    pedido(http).flush({}, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar las aceptaciones');
    boton(root, 'Reintentar').click();
    await asentar(harness);
    pedido(http).flush(reporte());
    await asentar(harness);
    expect(root.textContent).toContain('Ana Pérez');
    http.verify();
  });
});
