import { By } from '@angular/platform-browser';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { OrgPickerComponent } from '../../../shared/ui/org-picker.component';
import type { EndpointRow } from '../data/integrations.models';
import { DeliveriesComponent } from './deliveries.component';
import { EndpointsComponent } from './endpoints.component';
import { KeysComponent } from './keys.component';

const ORG = '6a979ef858233f68f8ba543a';
const OTRA = '6a979ef858233f68f8ba543b';
const DELIVERIES = '/platform/integrations/deliveries';
const KEYS = '/platform/integrations/keys';
const ENDPOINTS = '/platform/integrations/endpoints';

const DESTINO: EndpointRow = {
  id: 'e1',
  organizationId: ORG,
  organizationName: 'Org Uno',
  url: 'https://cliente.example/v2',
  description: 'ERP',
  events: [],
  enabled: true,
  recentFailures: 0,
  lastFailureAt: null,
  lastError: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const entrarCon = async (url: string): Promise<HttpTestingController> => {
  const http = await configurar();
  conPermisos(['platform:operations']);
  await TestBed.inject(Router).navigateByUrl(url);
  return http;
};

const lista = (http: HttpTestingController, base: string) =>
  http.expectOne((req) => req.url.endsWith(base) && req.method === 'GET');

const resumen = (http: HttpTestingController, base: string) =>
  http.expectOne((req) => req.url.endsWith(`${base}/summary`));

const elegirOrganizacion = (fixture: ComponentFixture<unknown>, id: string | null): void => {
  const picker = fixture.debugElement.query(By.directive(OrgPickerComponent)).componentInstance as OrgPickerComponent;
  picker.picked.emit(id);
};

const limpiarBusquedas = (http: HttpTestingController): void => {
  http.match((req) => req.url.includes('/platform/organizations')).forEach((req) => req.flush({ data: [] }));
};

describe('Integraciones: filtros en la URL', () => {
  it('Entregas abre con la organización y la vista del enlace, y cuenta solo esa organización', async () => {
    const http = await entrarCon(`/?organizacion=${ORG}&vista=exhausted`);
    const fixture = TestBed.createComponent(DeliveriesComponent);
    const pedido = lista(http, DELIVERIES);
    expect(pedido.request.params.get('organizationId')).toBe(ORG);
    expect(pedido.request.params.get('status')).toBe('exhausted');
    pedido.flush({ data: [], nextCursor: null });
    const conteo = resumen(http, DELIVERIES);
    expect(conteo.request.params.get('organizationId')).toBe(ORG);
    conteo.flush({ pending: 0, failed: 0, exhausted: 0 });
    limpiarBusquedas(http);
    await asentar(fixture);
  });

  it('ignora una organización o una vista que no sirven', async () => {
    const http = await entrarCon('/?organizacion=otra-cosa&vista=inventada');
    TestBed.createComponent(DeliveriesComponent);
    const pedido = lista(http, DELIVERIES);
    expect(pedido.request.params.has('organizationId')).toBe(false);
    expect(pedido.request.params.has('status')).toBe(false);
    pedido.flush({ data: [], nextCursor: null });
    const conteo = resumen(http, DELIVERIES);
    expect(conteo.request.params.has('organizationId')).toBe(false);
    conteo.flush({ pending: 0, failed: 0, exhausted: 0 });
  });

  it('al elegir organización en Entregas actualiza conteos, URL y enlaces de las pestañas', async () => {
    const http = await entrarCon('/');
    const fixture = TestBed.createComponent(DeliveriesComponent);
    lista(http, DELIVERIES).flush({ data: [], nextCursor: null });
    resumen(http, DELIVERIES).flush({ pending: 1, failed: 2, exhausted: 3 });
    await asentar(fixture);

    elegirOrganizacion(fixture, OTRA);
    const pedido = lista(http, DELIVERIES);
    expect(pedido.request.params.get('organizationId')).toBe(OTRA);
    pedido.flush({ data: [], nextCursor: null });
    const conteo = resumen(http, DELIVERIES);
    expect(conteo.request.params.get('organizationId')).toBe(OTRA);
    conteo.flush({ pending: 0, failed: 0, exhausted: 7 });
    limpiarBusquedas(http);
    await asentar(fixture);

    const root = fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(Router).url).toContain(`organizacion=${OTRA}`);
    const claves = [...root.querySelectorAll<HTMLAnchorElement>('a.tab')].find((a) => a.textContent?.includes('Claves'));
    expect(claves?.getAttribute('href')).toContain(`organizacion=${OTRA}`);
    expect(root.querySelector('db-filter-pills')?.textContent).toContain('7');
  });

  it('Claves cuenta y lista solo la organización del enlace', async () => {
    const http = await entrarCon(`/?organizacion=${ORG}&vista=expired`);
    const fixture = TestBed.createComponent(KeysComponent);
    const pedido = lista(http, KEYS);
    expect(pedido.request.params.get('organizationId')).toBe(ORG);
    expect(pedido.request.params.get('filter')).toBe('expired');
    pedido.flush({ data: [], nextCursor: null });
    const conteo = resumen(http, KEYS);
    expect(conteo.request.params.get('organizationId')).toBe(ORG);
    conteo.flush({ expiring: 0, unused: 0, expired: 0 });
    limpiarBusquedas(http);
    await asentar(fixture);

    elegirOrganizacion(fixture, null);
    const todas = lista(http, KEYS);
    expect(todas.request.params.has('organizationId')).toBe(false);
    todas.flush({ data: [], nextCursor: null });
    const conteoTodas = resumen(http, KEYS);
    expect(conteoTodas.request.params.has('organizationId')).toBe(false);
    conteoTodas.flush({ expiring: 1, unused: 1, expired: 1 });
    await asentar(fixture);
    expect(TestBed.inject(Router).url).not.toContain('organizacion');
  });

  it('Destinos abre con el enlace y su detalle lleva a las entregas de la organización', async () => {
    const http = await entrarCon(`/?organizacion=${ORG}&vista=false`);
    const fixture = TestBed.createComponent(EndpointsComponent);
    const pedido = lista(http, ENDPOINTS);
    expect(pedido.request.params.get('organizationId')).toBe(ORG);
    expect(pedido.request.params.get('enabled')).toBe('false');
    pedido.flush({ data: [DESTINO], nextCursor: null });
    limpiarBusquedas(http);
    await asentar(fixture);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.bl-row')?.click();
    await asentar(fixture);
    const enlace = [...document.querySelectorAll<HTMLAnchorElement>('dba-endpoint-detail a')].find((a) =>
      a.textContent?.includes('Ver las entregas'),
    );
    expect(enlace?.getAttribute('href')).toContain(`organizacion=${ORG}`);
  });
});
