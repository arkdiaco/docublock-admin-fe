import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import type { EndpointRow } from '../data/integrations.models';
import { ENDPOINTS_LIMIT, EndpointsComponent } from './endpoints.component';

const LLAVE_CRUDA = /\b(iep|dlv|nav|common|sub)\.[a-zA-Z]/;
const BASE = '/platform/integrations/endpoints';

const FILA: EndpointRow = {
  id: 'e1',
  organizationId: '6a979ef858233f68f8ba543a',
  organizationName: 'Org Uno',
  url: 'https://cliente.example/hook',
  description: 'ERP',
  events: [],
  enabled: true,
  createdAt: '2026-01-01T10:00:00.000Z',
  recentFailures: 4,
  lastFailureAt: '2026-11-04T10:00:00.000Z',
  lastError: 'HTTP 500',
};

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const atender = (http: HttpTestingController, data: EndpointRow[] = [FILA]) => {
  http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET').flush({ data, nextCursor: null });
};

const montar = async (permisos: string[], data: EndpointRow[] = [FILA]) => {
  const http = await configurar();
  conPermisos(permisos);
  const fixture = TestBed.createComponent(EndpointsComponent);
  atender(http, data);
  await asentar(fixture);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const botonCon = (texto: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(texto));

const abrir = async (fixture: ComponentFixture<unknown>, root: HTMLElement) => {
  root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
  await asentar(fixture);
};

const motivo = async (fixture: ComponentFixture<unknown>, texto: string) => {
  const campo = document.querySelector<HTMLInputElement>('.form input, .form textarea');
  if (!campo) throw new Error('Falta el campo de motivo');
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
  await asentar(fixture);
};

describe('Integraciones: destinos', () => {
  it('lista destino, estado y fallos recientes, sin llaves crudas', async () => {
    const { root } = await montar(['platform:operations']);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Org Uno');
    expect(texto).toContain('https://cliente.example/hook');
    expect(texto).toContain('Habilitado');
    expect(texto).toContain('HTTP 500');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('filtra por estado y pide con el límite', async () => {
    const { fixture, http } = await montar(['platform:operations']);
    botonCon('Deshabilitados')?.click();
    await asentar(fixture);
    const pedido = http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET');
    expect(pedido.request.params.get('enabled')).toBe('false');
    expect(pedido.request.params.get('limit')).toBe(String(ENDPOINTS_LIMIT));
    pedido.flush({ data: [], nextCursor: null });
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ningún destino con estos filtros');
  });

  it('avisa si el servicio no responde', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(EndpointsComponent);
    http
      .expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET')
      .flush({}, { status: 503, statusText: 'No disponible' });
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('El servicio de integraciones no responde');
  });

  it('sin permiso de administrar no ofrece cambiar', async () => {
    const { fixture, root } = await montar(['platform:operations']);
    await abrir(fixture, root);
    expect(botonCon('Deshabilitar')).toBeUndefined();
    expect(document.querySelector('dba-endpoint-detail')?.textContent).toContain('Todos los eventos');
  });

  it('deshabilita con motivo tras avisar de las pendientes', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    await abrir(fixture, root);
    botonCon('Deshabilitar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('entregas pendientes quedarán agotadas');
    expect(botonCon('Deshabilitar ahora')?.disabled).toBe(true);
    await motivo(fixture, 'El cliente lo pidió');
    botonCon('Deshabilitar ahora')?.click();
    const envio = http.expectOne(`${BASE}/e1`);
    expect(envio.request.method).toBe('PATCH');
    expect(envio.request.body).toEqual({ enabled: false, reason: 'El cliente lo pidió' });
    envio.flush({});
    await asentar(fixture);
    atender(http, [{ ...FILA, enabled: false }]);
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Deshabilitado');
  });

  it('habilitar avisa que las agotadas no salen solas', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage'], [{ ...FILA, enabled: false }]);
    await abrir(fixture, root);
    botonCon('Habilitar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('no salen solas');
    await motivo(fixture, 'Ya funciona');
    botonCon('Habilitar ahora')?.click();
    const envio = http.expectOne(`${BASE}/e1`);
    expect(envio.request.body).toEqual({ enabled: true, reason: 'Ya funciona' });
    envio.flush({}, { status: 404, statusText: 'No existe' });
    await asentar(fixture);
    expect(document.querySelector('dba-endpoint-toggle-confirm')).not.toBeNull();
  });
});
