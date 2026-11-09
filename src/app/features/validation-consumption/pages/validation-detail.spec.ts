import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type { ConsumptionCounts, DetailItem, ValidationDetail } from '../data/consumption.models';
import {
  backParamsOf,
  detailFiltersOf,
  detailQueryParamsOf,
  detailRequestOf,
  monthLabelOf,
  monthsOfPage,
  scopeOf,
} from '../data/detail-view';
import { ValidationDetailComponent } from './validation-detail.component';

const LLAVE_CRUDA = /\b(vdet|vcon|nav|common)\.[a-zA-Z]/;
const DETAIL = '/platform/validation-credits/detail';
const RESELLER = '6af18dadc6604a5a096a4529';
const ORG = '6af18dadc6604a5a096a452a';
const BASE = '/inteligencia/consumo-validaciones';

const cuentas = (
  ani: number,
  liveness: number,
  macherFacial = 0,
  otros = 0,
): ConsumptionCounts => ({
  ani,
  liveness,
  macherFacial,
  otros,
  total: ani + liveness + macherFacial + otros,
});

const UNO: DetailItem = {
  month: '2026-11',
  document: { id: 'd1', name: 'Contrato uno', code: 'CU-001' },
  organization: { id: ORG, name: 'Org Con Reseller' },
  counts: cuentas(2, 1),
  signers: [
    {
      identityId: 'i1',
      signerId: 's1',
      name: 'Ana Pérez',
      identification: '1020',
      counts: cuentas(2, 1),
      validations: [
        {
          type: 'ani',
          rawType: 'ani-previous-fail',
          date: '2026-11-01T15:00:00.000Z',
          result: 'failed',
          retry: true,
          copy: false,
          source: 'legacy',
        },
        {
          type: 'ani',
          rawType: 'ani',
          date: '2026-11-02T15:00:00.000Z',
          result: 'passed',
          retry: false,
          copy: false,
          source: 'legacy',
        },
        {
          type: 'liveness',
          rawType: 'liveness',
          date: '2026-11-02T15:00:00.000Z',
          result: 'unknown',
          retry: false,
          copy: false,
          source: 'core',
        },
      ],
    },
  ],
};

const DOS: DetailItem = {
  month: '2026-11',
  document: { id: 'd2', name: 'Contrato dos' },
  organization: { id: ORG, name: 'Org Con Reseller' },
  counts: cuentas(0, 0),
  signers: [
    {
      identityId: 'i1',
      name: 'Ana Pérez',
      counts: cuentas(0, 0),
      validations: [
        {
          type: 'ani',
          rawType: 'ani',
          date: '2026-11-02T15:00:00.000Z',
          result: 'passed',
          retry: false,
          copy: true,
          source: 'legacy',
        },
      ],
    },
  ],
};

const COBRO = { currency: 'COP', lines: [], total: 5000 };

const detalle = (over: Partial<ValidationDetail> = {}): ValidationDetail => ({
  scope: 'organization',
  entity: { id: ORG, businessName: 'Org Con Reseller' },
  billedVia: { id: RESELLER, businessName: 'Reseller Norte' },
  pricing: { configured: true, mode: 'per_validation', currency: 'COP' },
  timeZone: 'America/Bogota',
  capped: false,
  totals: cuentas(2, 1),
  packages: 2,
  billing: COBRO,
  months: [
    {
      month: '2026-11',
      documents: 2,
      signers: 1,
      packages: 2,
      counts: cuentas(2, 1),
      billing: COBRO,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  items: [UNO, DOS],
  ...over,
});

describe('Detalle del consumo: reglas de la vista', () => {
  it('lee el alcance, los filtros y la página de la URL y descarta lo que no sirve', () => {
    expect(scopeOf('organizacion')).toBe('organization');
    expect(scopeOf('reseller')).toBe('reseller');
    expect(scopeOf('otra')).toBeNull();
    expect(
      detailFiltersOf({
        desde: '2026-11-01',
        vista: 'resellers',
        tipo: 'liveness',
        buscar: 'pc',
        pagina: '3',
      }),
    ).toEqual({
      from: '2026-11-01',
      to: null,
      view: 'resellers',
      type: 'liveness',
      search: 'pc',
      page: 3,
    });
    expect(detailFiltersOf({ tipo: 'ANI', pagina: '-2', buscar: 'x'.repeat(200) })).toMatchObject({
      type: 'todos',
      page: 1,
      search: 'x'.repeat(120),
    });
  });

  it('la URL guarda solo lo que cambia y «Volver» conserva periodo y vista', () => {
    const filtros = detailFiltersOf({
      desde: '2026-11-01',
      vista: 'resellers',
      tipo: 'ani',
      buscar: ' pc ',
    });
    expect(detailQueryParamsOf({ ...filtros, page: 1 })).toEqual({
      desde: '2026-11-01',
      hasta: null,
      vista: 'resellers',
      tipo: 'ani',
      buscar: 'pc',
      pagina: null,
    });
    expect(backParamsOf(filtros)).toEqual({ desde: '2026-11-01', vista: 'resellers' });
    const pedido = detailRequestOf('reseller', RESELLER, filtros, 'America/Bogota');
    expect(pedido).toMatchObject({
      scope: 'reseller',
      entityId: RESELLER,
      type: 'ani',
      search: 'pc',
    });
    expect(new Date(pedido.from!).getTime()).toBe(new Date('2026-11-01T00:00:00').getTime());
    expect(pedido.to).toBeUndefined();
    expect(detailRequestOf('organization', ORG, detailFiltersOf({}), 'UTC')).toEqual({
      scope: 'organization',
      entityId: ORG,
      from: undefined,
      to: undefined,
      tz: 'UTC',
    });
  });

  it('nombra el mes y agrupa la página por mes sin reordenar', () => {
    expect(monthLabelOf('2026-11', 'es')).toBe('Noviembre de 2026');
    const octubre = { ...DOS, month: '2026-10' };
    expect(monthsOfPage([UNO, DOS, octubre]).map((g) => [g.month, g.items.length])).toEqual([
      ['2026-11', 2],
      ['2026-10', 1],
    ]);
  });
});

const montar = async (permisos: string[], url = `${BASE}/organizacion/${ORG}`) => {
  const http = await configurar();
  conPermisos(permisos);
  TestBed.inject(Router).resetConfig([
    {
      path: 'inteligencia/consumo-validaciones/:alcance/:id',
      component: ValidationDetailComponent,
    },
  ]);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, ValidationDetailComponent);
  return { harness, http, root: harness.routeNativeElement as HTMLElement };
};

const pedido = (http: HttpTestingController): TestRequest =>
  http.expectOne((req) => req.url.endsWith(DETAIL) && req.method === 'GET');

const asentar = async (harness: RouterTestingHarness): Promise<void> => {
  await harness.fixture.whenStable();
  harness.detectChanges();
};

const botones = (root: HTMLElement, etiqueta: string): HTMLButtonElement[] =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].filter((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(etiqueta),
  );

describe('Detalle del consumo', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('con solo Inteligencia muestra resumen, documentos, firmantes y validaciones sin enlaces', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    const primero = pedido(http);
    expect(primero.request.params.get('scope')).toBe('organization');
    expect(primero.request.params.get('entityId')).toBe(ORG);
    expect(primero.request.params.get('page')).toBe('1');
    expect(primero.request.params.get('limit')).toBe('20');
    expect(primero.request.params.get('tz')).toBeTruthy();
    primero.flush(detalle());
    await asentar(harness);

    let texto = root.textContent ?? '';
    expect(texto).toContain('Org Con Reseller');
    expect(texto).toContain('Se cobra con la tarifa del reseller Reseller Norte');
    expect(texto).toContain('Resumen por mes');
    expect(texto).toContain('November 2026');
    expect(texto).toContain('CU-001');
    expect(texto).toContain('Sin código');
    expect(root.querySelectorAll('a.dba-ref')).toHaveLength(0);

    botones(root, 'Ver firmantes de Contrato uno')[0].click();
    await asentar(harness);
    expect(root.textContent).toContain('Ana Pérez');
    expect(root.textContent).toContain('CR 2 · LV 1');
    botones(root, 'Ver validaciones de Ana Pérez')[0].click();
    await asentar(harness);
    texto = root.textContent ?? '';
    expect(texto).toContain('Fallida');
    expect(texto).toContain('Aprobada');
    expect(texto).toContain('Sin dato');
    expect(texto).toContain('Reintento');

    botones(root, 'Ver firmantes de Contrato dos')[0].click();
    await asentar(harness);
    botones(root, 'Ver validaciones de Ana Pérez')[1].click();
    await asentar(harness);
    texto = root.textContent ?? '';
    expect(texto).toContain('Copia · no cuenta');
    expect(texto).not.toMatch(/\bANI\b/);
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('con Operación y Clientes enlaza documento, firmante y organización', async () => {
    const { harness, http, root } = await montar(
      ['platform:intelligence', 'platform:operations', 'platform:clients'],
      `${BASE}/reseller/${RESELLER}?desde=2026-11-01&vista=resellers`,
    );
    pedido(http).flush(
      detalle({
        scope: 'reseller',
        entity: { id: RESELLER, businessName: 'Reseller Norte' },
        billedVia: null,
      }),
    );
    await asentar(harness);
    botones(root, 'Ver firmantes de Contrato uno')[0].click();
    await asentar(harness);
    const enlaces = [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/operacion/documentos/d1');
    expect(enlaces).toContain(`/clientes/organizaciones/${ORG}`);
    expect(enlaces).toContain('/clientes/firmantes/s1');
    expect(enlaces).toContain(`${BASE}?desde=2026-11-01&vista=resellers`);
    expect(root.textContent).toContain('Reseller');
    http.verify();
  });

  it('el tipo, la búsqueda y la página viajan al backend y a la URL', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { harness, http, root } = await montar(['platform:intelligence']);
      pedido(http).flush(detalle({ total: 45 }));
      await asentar(harness);

      [...root.querySelectorAll<HTMLButtonElement>('button')]
        .find((b) => b.textContent?.trim() === 'Liveness')!
        .click();
      await asentar(harness);
      const porTipo = pedido(http);
      expect(porTipo.request.params.get('type')).toBe('liveness');
      porTipo.flush(detalle({ total: 45 }));
      await asentar(harness);

      const buscar = root.querySelector<HTMLInputElement>('input[type="search"]')!;
      buscar.value = 'contrato';
      buscar.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(400);
      await asentar(harness);
      const porBusqueda = pedido(http);
      expect(porBusqueda.request.params.get('search')).toBe('contrato');
      expect(porBusqueda.request.params.get('type')).toBe('liveness');
      porBusqueda.flush(detalle({ total: 45 }));
      await asentar(harness);

      expect(root.textContent).toContain('1–2 de 45 documentos');
      botones(root, 'Página siguiente')[0].click();
      await asentar(harness);
      const siguiente = pedido(http);
      expect(siguiente.request.params.get('page')).toBe('2');
      siguiente.flush(detalle({ total: 45, page: 2 }));
      await asentar(harness);
      expect(TestBed.inject(Router).url).toContain('pagina=2');
      expect(TestBed.inject(Router).url).toContain('tipo=liveness');
      expect(TestBed.inject(Router).url).toContain('buscar=contrato');
      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin tarifa lo dice y el periodo recortado avisa', async () => {
    const { harness, http, root } = await montar(['platform:intelligence']);
    pedido(http).flush(
      detalle({
        pricing: null,
        billing: null,
        billedVia: null,
        capped: true,
        months: [{ ...detalle().months[0], billing: null }],
      }),
    );
    await asentar(harness);
    const texto = root.textContent ?? '';
    expect(texto).toContain('no tiene tarifa de validaciones configurada');
    expect(texto).toContain('las cifras son parciales');
    expect(texto).toContain('Sin tarifa');
  });

  it('un alcance desconocido no consulta y una cuenta que no existe lo dice', async () => {
    const malo = await montar(['platform:intelligence'], `${BASE}/otra/${ORG}`);
    await asentar(malo.harness);
    malo.http.expectNone((req) => req.url.endsWith(DETAIL));
    expect(malo.root.textContent).toContain('No encontramos esta cuenta');
    TestBed.inject(Router).dispose();
    TestBed.resetTestingModule();

    const { harness, http, root } = await montar(['platform:intelligence']);
    pedido(http).flush(
      { code: 'ORGANIZACION_NO_ENCONTRADA' },
      { status: 404, statusText: 'Not Found' },
    );
    await asentar(harness);
    expect(root.textContent).toContain('No encontramos esta cuenta');
  });

  it('si el detalle falla ofrece reintentar y exporta el CSV con los mismos filtros', async () => {
    const { harness, http, root } = await montar(
      ['platform:intelligence'],
      `${BASE}/organizacion/${ORG}?tipo=ani`,
    );
    pedido(http).flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    await asentar(harness);
    expect(root.textContent).toContain('No pudimos cargar el detalle');
    botones(root, 'Reintentar')[0].click();
    pedido(http).flush(detalle());
    await asentar(harness);

    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    botones(root, 'Exportar CSV')[0].click();
    const csv = http.expectOne((req) => req.url.endsWith(`${DETAIL}.csv`));
    expect(csv.request.params.get('type')).toBe('ani');
    expect(csv.request.params.has('page')).toBe(false);
    csv.flush(new Blob(['a,b']), {
      headers: { 'content-disposition': 'attachment; filename="consumo-validaciones-org.csv"' },
    });
    await asentar(harness);
    expect(crear).toHaveBeenCalled();

    botones(root, 'Descargar PDF')[0].click();
    const pdf = http.expectOne((req) => req.url.endsWith(`${DETAIL}/pdf`) && req.method === 'POST');
    expect(pdf.request.body).toMatchObject({ scope: 'organization', entityId: ORG, type: 'ani' });
    pdf.flush(new Blob(['%PDF']));
    await asentar(harness);
    expect(crear).toHaveBeenCalledTimes(2);
    http.verify();
  });
});
