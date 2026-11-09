import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type {
  ConsumptionCounts,
  ConsumptionReport,
  OrganizationConsumption,
  ResellerConsumption,
} from '../data/consumption.models';
import {
  consumptionCsv,
  csvFilename,
  filtersOf,
  organizationValueOf,
  queryParamsOf,
  rangeInvalid,
  rangeOf,
  resellerValueOf,
  type CsvLabels,
} from '../data/consumption-view';
import { ValidationConsumptionComponent } from './validation-consumption.component';

const LLAVE_CRUDA = /\b(vcon|val|nav|common)\.[a-zA-Z]/;
const REPORT = '/platform/validation-credits/report';
const RESELLER = '6af18dadc6604a5a096a4529';
const CON_RESELLER = '6af18dadc6604a5a096a452a';
const DIRECTA = '6af18dadc6604a5a096a452b';

const cuentas = (
  ani: number,
  liveness: number,
  macherFacial: number,
  otros = 0,
): ConsumptionCounts => ({
  ani,
  liveness,
  macherFacial,
  otros,
  total: ani + liveness + macherFacial + otros,
});

const COBRO = { currency: 'COP', lines: [], total: 5000 };

const ORG_DIRECTA: OrganizationConsumption = {
  organizationId: DIRECTA,
  businessName: 'Org Directa',
  reseller: null,
  counts: cuentas(1, 1, 1, 1),
  packages: 1,
  pricing: null,
  billedViaReseller: false,
  billing: COBRO,
};

const ORG_CON_RESELLER: OrganizationConsumption = {
  organizationId: CON_RESELLER,
  businessName: 'Org Con Reseller',
  reseller: { id: RESELLER, businessName: 'Reseller Norte' },
  counts: cuentas(2, 1, 0),
  packages: 2,
  pricing: null,
  billedViaReseller: true,
  billing: null,
};

const ORG_SIN_TARIFA: OrganizationConsumption = {
  ...ORG_DIRECTA,
  organizationId: '6af18dadc6604a5a096a452c',
  businessName: '=Org Sin Tarifa',
  counts: cuentas(0, 0, 1),
  billing: null,
};

const RES_NORTE: ResellerConsumption = {
  resellerId: RESELLER,
  businessName: 'Reseller Norte',
  organizations: 1,
  counts: cuentas(2, 1, 0),
  packages: 2,
  pricing: null,
  billing: { currency: 'COP', lines: [], total: 4000 },
};

const SIN_RESELLER: ResellerConsumption = {
  resellerId: null,
  businessName: 'Sin reseller',
  organizations: 2,
  counts: cuentas(1, 1, 2, 1),
  packages: 2,
  pricing: null,
  billing: null,
};

const REPORTE: ConsumptionReport = {
  totals: cuentas(3, 2, 2, 1),
  organizations: [ORG_DIRECTA, ORG_CON_RESELLER, ORG_SIN_TARIFA],
  resellers: [SIN_RESELLER, RES_NORTE],
};

const ETIQUETAS: CsvLabels = {
  organization: 'Organización',
  reseller: 'Reseller',
  organizations: 'Organizaciones',
  types: { ani: 'CR', liveness: 'LV', macherFacial: 'BA', otros: 'Otros' },
  total: 'Total',
  packages: 'Paquetes',
  value: 'Valor',
  currency: 'Moneda',
  viaReseller: 'Vía reseller',
  noPricing: 'Sin tarifa',
  noReseller: 'Sin reseller',
};

describe('Consumo de validaciones: reglas de la vista', () => {
  it('lee el periodo y la vista de la URL y descarta lo que no sirve', () => {
    expect(filtersOf({ desde: '2026-11-01', hasta: '2026-11-30', vista: 'resellers' })).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      view: 'resellers',
    });
    expect(filtersOf({ desde: '01/11/2026', hasta: '2026-13-45', vista: 'otra' })).toEqual({
      from: null,
      to: null,
      view: 'organizaciones',
    });
    expect(queryParamsOf({ from: '2026-11-01', to: null, view: 'organizaciones' })).toEqual({
      desde: '2026-11-01',
      hasta: null,
      vista: null,
    });
  });

  it('el rango cierra en el final del día de «Hasta» y avisa si está invertido', () => {
    const rango = rangeOf({ from: '2026-11-01', to: '2026-11-30', view: 'organizaciones' });
    expect(new Date(rango.to!).getTime()).toBe(new Date('2026-11-30T23:59:59.999').getTime());
    expect(new Date(rango.from!).getTime()).toBe(new Date('2026-11-01T00:00:00').getTime());
    expect(rangeOf({ from: null, to: null, view: 'resellers' })).toEqual({
      from: undefined,
      to: undefined,
    });
    expect(rangeInvalid({ from: '2026-11-30', to: '2026-11-01', view: 'organizaciones' })).toBe(
      true,
    );
    expect(rangeInvalid({ from: '2026-11-01', to: null, view: 'organizaciones' })).toBe(false);
  });

  it('el valor distingue cobro, «vía reseller», «sin tarifa» y la fila sin reseller', () => {
    expect(organizationValueOf(ORG_DIRECTA)).toEqual({ kind: 'amount', billing: COBRO });
    expect(organizationValueOf(ORG_CON_RESELLER)).toEqual({ kind: 'viaReseller' });
    expect(organizationValueOf(ORG_SIN_TARIFA)).toEqual({ kind: 'noPricing' });
    expect(resellerValueOf(RES_NORTE).kind).toBe('amount');
    expect(resellerValueOf(SIN_RESELLER)).toEqual({ kind: 'none' });
    expect(resellerValueOf({ ...RES_NORTE, billing: null })).toEqual({ kind: 'noPricing' });
  });

  it('el CSV lleva todas las filas, neutraliza fórmulas y nombra la fila sin reseller', () => {
    const porOrganizacion = consumptionCsv('organizaciones', REPORTE, ETIQUETAS).split('\r\n');
    expect(porOrganizacion).toEqual([
      'Organización,Reseller,CR,LV,BA,Otros,Total,Paquetes,Valor,Moneda',
      'Org Directa,,1,1,1,1,4,1,5000,COP',
      'Org Con Reseller,Reseller Norte,2,1,0,0,3,2,Vía reseller,',
      "'=Org Sin Tarifa,,0,0,1,0,1,1,Sin tarifa,",
    ]);
    const porReseller = consumptionCsv(
      'resellers',
      {
        ...REPORTE,
        resellers: [{ ...SIN_RESELLER }, { ...RES_NORTE, businessName: 'Norte, S.A.' }],
      },
      ETIQUETAS,
    ).split('\r\n');
    expect(porReseller[0]).toBe(
      'Reseller,Organizaciones,CR,LV,BA,Otros,Total,Paquetes,Valor,Moneda',
    );
    expect(porReseller[1]).toBe('Sin reseller,2,1,1,2,1,5,2,,');
    expect(porReseller[2]).toBe('"Norte, S.A.",1,2,1,0,0,3,2,4000,COP');
    expect(csvFilename({ from: null, to: '2026-11-30', view: 'resellers' })).toBe(
      'consumo-validaciones-resellers-inicio-2026-11-30.csv',
    );
  });
});

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(REPORT) && req.method === 'GET');

const montar = async (permisos: string[], url = '/') => {
  const http = await configurar();
  conPermisos(permisos);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(ValidationConsumptionComponent);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const filas = (root: HTMLElement): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('.dba-tr'),
];

const opcionesDe = async (
  fixture: ComponentFixture<unknown>,
  fila: HTMLElement,
): Promise<string[]> => {
  const boton = fila.querySelector<HTMLButtonElement>('.vc__more')!;
  boton.click();
  await asentar(fixture);
  const opciones = [...document.querySelectorAll('[role="menuitem"]')].map(
    (item) => item.textContent?.trim() ?? '',
  );
  boton.click();
  await asentar(fixture);
  return opciones;
};

describe('Consumo de validaciones', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('con solo Inteligencia muestra cifras y filas, sin enlaces y solo con el detalle', async () => {
    const { fixture, http, root } = await montar(['platform:intelligence']);
    const primero = pedido(http);
    expect(primero.request.params.has('from')).toBe(false);
    expect(primero.request.params.has('to')).toBe(false);
    primero.flush(REPORTE);
    await asentar(fixture);

    const texto = root.textContent ?? '';
    expect(texto).toContain('Consumo de validaciones');
    expect(texto).toContain('Consultar Registraduría');
    expect(texto).toContain('No se cobran');
    expect(texto).toContain('Vía reseller');
    expect(texto).toContain('Sin tarifa');
    expect(texto).toContain('Directa');
    expect(texto).not.toMatch(/\bANI\b/);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    expect(filas(root)).toHaveLength(3);
    expect(root.querySelectorAll('a.dba-ref')).toHaveLength(0);
    expect(root.querySelectorAll('.vc__more')).toHaveLength(3);
    for (const fila of filas(root)) {
      expect(await opcionesDe(fixture, fila)).toEqual(['Ver detalle']);
    }
    http.verify();
  });

  it('con Clientes y Comercial enlaza las fichas y ofrece tarifa y cuenta de cobro', async () => {
    const { fixture, http, root } = await montar([
      'platform:intelligence',
      'platform:clients',
      'platform:clients:manage',
      'platform:commercial',
    ]);
    pedido(http).flush(REPORTE);
    await asentar(fixture);

    const enlaces = [...root.querySelectorAll('a.dba-ref')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain(`/clientes/organizaciones/${DIRECTA}`);
    expect(enlaces).toContain(`/comercial/resellers/${RESELLER}`);

    const [directa, conReseller, sinTarifa] = filas(root);
    expect(await opcionesDe(fixture, conReseller)).toEqual(['Ver detalle']);
    expect(await opcionesDe(fixture, directa)).toEqual([
      'Ver detalle',
      'Tarifa',
      'Cuenta de cobro del periodo',
    ]);
    expect(await opcionesDe(fixture, sinTarifa)).toEqual(['Ver detalle', 'Tarifa']);
    http.verify();
  });

  it('lectura de Clientes sin gestión solo descarga la cuenta de cobro', async () => {
    const { fixture, http, root } = await montar(['platform:intelligence', 'platform:clients']);
    pedido(http).flush(REPORTE);
    await asentar(fixture);
    expect(await opcionesDe(fixture, filas(root)[0])).toEqual([
      'Ver detalle',
      'Cuenta de cobro del periodo',
    ]);
  });

  it('respeta el periodo y la vista de la URL; la fila sin reseller no tiene acciones', async () => {
    const { fixture, http, root } = await montar(
      ['platform:intelligence', 'platform:clients', 'platform:clients:manage'],
      '/?desde=2026-11-01&hasta=2026-11-30&vista=resellers',
    );
    const primero = pedido(http);
    expect(new Date(primero.request.params.get('from')!).getTime()).toBe(
      new Date('2026-11-01T00:00:00').getTime(),
    );
    expect(new Date(primero.request.params.get('to')!).getTime()).toBe(
      new Date('2026-11-30T23:59:59.999').getTime(),
    );
    primero.flush(REPORTE);
    await asentar(fixture);

    const [sinReseller, norte] = filas(root);
    expect(sinReseller.textContent).toContain('Sin reseller');
    expect(sinReseller.querySelector('.vc__more')).toBeNull();
    expect(norte.textContent).toContain('Reseller Norte');
    expect(norte.textContent).toMatch(/COP\s4,000/);
    expect(await opcionesDe(fixture, norte)).toEqual([
      'Ver detalle',
      'Tarifa',
      'Cuenta de cobro del periodo',
    ]);
  });

  it('«Ver detalle» abre el detalle de la cuenta y conserva el periodo y la vista', async () => {
    const { fixture, http, root } = await montar(
      ['platform:intelligence'],
      '/?desde=2026-11-01&vista=resellers',
    );
    pedido(http).flush(REPORTE);
    await asentar(fixture);
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    filas(root)[1].querySelector<HTMLButtonElement>('.vc__more')!.click();
    await asentar(fixture);
    document.querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await asentar(fixture);
    expect(navegar).toHaveBeenCalledWith(
      ['/inteligencia/consumo-validaciones', 'reseller', RESELLER],
      { queryParams: { desde: '2026-11-01', hasta: null, vista: 'resellers' } },
    );
  });

  it('con el rango invertido avisa y no consulta', async () => {
    const { fixture, http, root } = await montar(
      ['platform:intelligence'],
      '/?desde=2026-11-30&hasta=2026-11-01',
    );
    await asentar(fixture);
    http.expectNone((req) => req.url.endsWith(REPORT));
    expect(root.textContent).toContain('La fecha «Desde» es posterior a «Hasta».');
  });

  it('si el reporte falla ofrece reintentar', async () => {
    const { fixture, http, root } = await montar(['platform:intelligence']);
    pedido(http).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    expect(root.textContent).toContain('No pudimos cargar el consumo');
    const reintentar = [...root.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Reintentar'),
    );
    reintentar!.click();
    pedido(http).flush(REPORTE);
    await asentar(fixture);
    expect(filas(root)).toHaveLength(3);
  });
});
