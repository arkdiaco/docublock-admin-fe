import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type { CodeDeliveryReport, CodeDeliveryRow } from '../data/code-deliveries.models';
import {
  codeStateOf,
  detailOf,
  filtersOf,
  fromOf,
  queryParamsOf,
} from '../data/code-delivery-view';
import { CODE_DELIVERIES_LIMIT, CodeDeliveriesComponent } from './code-deliveries.component';

const LLAVE_CRUDA = /\b(cdl|nav|common)\.[a-zA-Z]/;
const BASE = '/platform/code-deliveries';
const ORG = '6a979ef858233f68f8ba543a';
const DOC = '6a979ef858233f68f8ba5400';

const cuenta = () => ({ accepted: 0, failed: 0, sent: 0, delivered: 0, read: 0, undelivered: 0 });

const FIRMA: CodeDeliveryRow = {
  id: 'c1',
  purpose: 'signing',
  channel: 'whatsapp',
  to: '••••••1332',
  status: 'undelivered',
  error: 'Message undeliverable',
  errorCode: 131026,
  organizationId: ORG,
  documentId: DOC,
  signerId: 's1',
  createdAt: '2026-11-06T10:00:00.000Z',
  statusAt: '2026-11-06T10:00:05.000Z',
  organizationName: 'Org Uno',
  documentName: 'Contrato de arriendo',
  personName: 'Ana Pérez',
};

const INGRESO: CodeDeliveryRow = {
  id: 'c2',
  purpose: 'login',
  channel: 'email',
  to: 'r••••@docublock.uk',
  status: 'accepted',
  portal: 'docublock',
  userId: 'u1',
  createdAt: '2026-11-06T09:00:00.000Z',
  statusAt: '2026-11-06T09:00:00.000Z',
  organizationName: null,
  documentName: null,
  personName: 'Roger P',
};

const reporte = (items: CodeDeliveryRow[], total = items.length): CodeDeliveryReport => ({
  total,
  page: 1,
  limit: CODE_DELIVERIES_LIMIT,
  items,
  totals: { all: cuenta(), byChannel: { email: cuenta(), sms: cuenta(), whatsapp: cuenta() } },
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

const montar = async (url = '/', items = [FIRMA, INGRESO], total?: number) => {
  const http = await configurar();
  conPermisos(['platform:operations']);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(CodeDeliveriesComponent);
  const primero = pedido(http);
  primero.flush(reporte(items, total));
  limpiarBusquedas(http);
  await asentar(fixture);
  return { fixture, http, primero, root: fixture.nativeElement as HTMLElement };
};

describe('Envíos de códigos', () => {
  it('lista los envíos con su estado, persona, organización y enlace a la trazabilidad', async () => {
    const { root, primero } = await montar();

    expect(primero.request.params.get('page')).toBe('1');
    expect(primero.request.params.get('limit')).toBe(String(CODE_DELIVERIES_LIMIT));
    expect(primero.request.params.has('from')).toBe(false);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Envíos de códigos');
    expect(texto).toContain('WhatsApp');
    expect(texto).toContain('••••••1332');
    expect(texto).toContain('No entregado');
    expect(texto).toContain('131026 · Message undeliverable');
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('Org Uno');
    expect(texto).toContain('Sin organización');
    expect(texto).not.toMatch(LLAVE_CRUDA);

    const enlace = root.querySelector<HTMLAnchorElement>('.dba-tr a.dba-ref');
    expect(enlace?.textContent?.trim()).toBe('Contrato de arriendo');
    expect(enlace?.getAttribute('href')).toMatch(new RegExp(`/${DOC}\\?tab=trace$`));
  });

  it('lee los filtros de la URL y los manda al core', async () => {
    const { primero, root } = await montar(
      `/?para=signing&canal=sms&estado=failed&organizacion=${ORG}&periodo=7d&pagina=3`,
    );

    const params = primero.request.params;
    expect(params.get('purpose')).toBe('signing');
    expect(params.get('channel')).toBe('sms');
    expect(params.get('status')).toBe('failed');
    expect(params.get('organizationId')).toBe(ORG);
    expect(params.get('page')).toBe('3');
    expect(Date.parse(params.get('from') ?? '')).toBeLessThan(Date.now() - 6 * 24 * 3_600_000);
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
  });

  it('ignora en la URL lo que no es un filtro válido', async () => {
    const { primero } = await montar(
      '/?para=platform_login&canal=fax&organizacion=arkdia&pagina=-1',
    );

    const params = primero.request.params;
    expect(params.has('purpose')).toBe(false);
    expect(params.has('channel')).toBe(false);
    expect(params.has('organizationId')).toBe(false);
    expect(params.get('page')).toBe('1');
  });

  it('elegir organización vuelve a la primera página, lo guarda en la URL y avisa que los ingresos no tienen', async () => {
    const { fixture, http, root } = await montar('/?pagina=2');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    const picker = fixture.debugElement.query(By.directive(OrgPickerComponent))
      .componentInstance as OrgPickerComponent;
    picker.picked.emit(ORG);
    await asentar(fixture);

    const segundo = pedido(http);
    expect(segundo.request.params.get('organizationId')).toBe(ORG);
    expect(segundo.request.params.get('page')).toBe('1');
    segundo.flush(reporte([FIRMA]));
    limpiarBusquedas(http);
    await asentar(fixture);
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ organizacion: ORG, pagina: null }),
      }),
    );
    expect(root.textContent).toContain('ingresos');
  });

  it('pasar de página conserva los filtros', async () => {
    const { fixture, http } = await montar('/?canal=email', [INGRESO], 60);

    const siguiente = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.getAttribute('aria-label')?.toLowerCase().includes('siguiente'));
    expect(siguiente).toBeTruthy();
    siguiente?.click();
    await asentar(fixture);

    const segundo = pedido(http);
    expect(segundo.request.params.get('page')).toBe('2');
    expect(segundo.request.params.get('channel')).toBe('email');
    segundo.flush(reporte([INGRESO], 60));
  });

  it('una página que ya no existe salta a la última con envíos', async () => {
    const { fixture, http, primero, root } = await montar('/?canal=whatsapp&pagina=4', [], 30);

    expect(primero.request.params.get('page')).toBe('4');
    const segundo = pedido(http);
    expect(segundo.request.params.get('page')).toBe('2');
    expect(segundo.request.params.get('channel')).toBe('whatsapp');
    segundo.flush(reporte([FIRMA], 30));
    limpiarBusquedas(http);
    await asentar(fixture);
    expect(root.querySelectorAll('.dba-tr').length).toBe(1);
  });

  it('sin envíos muestra el vacío', async () => {
    const { root } = await montar('/', []);
    expect(root.querySelector('.dba-tr')).toBeNull();
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
  });

  it('si el core falla deja reintentar', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(CodeDeliveriesComponent);
    pedido(http).flush(null, { status: 500, statusText: 'x' });
    limpiarBusquedas(http);
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);

    const reintentar = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === 'Reintentar',
    );
    reintentar?.click();
    await asentar(fixture);
    pedido(http).flush(reporte([FIRMA]));
    limpiarBusquedas(http);
    await asentar(fixture);
    expect(root.textContent).toContain('Ana Pérez');
  });
});

describe('Vista de envíos de códigos', () => {
  it('descarta filtros que no conoce', () => {
    expect(
      filtersOf({
        para: 'platform_login',
        canal: 'fax',
        estado: 'x',
        organizacion: 'arkdia',
        periodo: '1y',
        pagina: '-2',
      }),
    ).toEqual({
      purpose: null,
      channel: null,
      status: null,
      organizationId: null,
      period: null,
      page: 1,
    });
  });

  it('escribe en la URL solo lo que hay y omite la página 1', () => {
    expect(
      queryParamsOf({
        purpose: 'login',
        channel: null,
        status: null,
        organizationId: null,
        period: '24h',
        page: 1,
      }),
    ).toEqual({
      para: 'login',
      canal: null,
      estado: null,
      organizacion: null,
      periodo: '24h',
      pagina: null,
    });
  });

  it('el periodo se vuelve una fecha desde', () => {
    const now = Date.parse('2026-11-06T12:00:00.000Z');
    expect(fromOf('24h', now)).toBe('2026-11-05T12:00:00.000Z');
    expect(fromOf(null, now)).toBeNull();
  });

  it('cada estado tiene su color y el detalle junta código y error', () => {
    expect(codeStateOf('delivered')).toBe('active');
    expect(codeStateOf('undelivered')).toBe('warning');
    expect(codeStateOf('failed')).toBe('suspended');
    expect(detailOf({ error: 'numero_invalido' })).toBe('numero_invalido');
    expect(detailOf({})).toBe('—');
  });
});
