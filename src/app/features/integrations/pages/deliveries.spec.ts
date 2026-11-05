import { HttpErrorResponse } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { resultOf, statusPills } from '../data/delivery-view';
import { isBridgeDown, replayErrorKey } from '../data/integrations.api';
import type { DeliveryDetail, DeliveryRow } from '../data/integrations.models';
import { DELIVERIES_LIMIT, DeliveriesComponent } from './deliveries.component';

const LLAVE_CRUDA = /\b(dlv|nav|common|sub)\.[a-zA-Z]/;
const BASE = '/platform/integrations/deliveries';
const ORG = '6a979ef858233f68f8ba543a';

const FILA: DeliveryRow = {
  id: 'd1',
  organizationId: ORG,
  organizationName: 'Org Uno',
  event: 'document.signed',
  contract: 'legacy',
  documentId: 'doc1',
  status: 'failed',
  attempts: 2,
  lastStatusCode: 500,
  lastError: 'HTTP 500',
  createdAt: '2026-11-05T10:00:00.000Z',
};

const DETALLE: DeliveryDetail = {
  ...FILA,
  destinationUrl: 'https://cliente.example/hook',
  nextAttemptAt: null,
  deliveredAt: null,
  lastSentAt: null,
  payload: { event: 'document.signed', contenido: 'visible-solo-al-abrir' },
};

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const atender = (http: HttpTestingController, data: DeliveryRow[] = [FILA], nextCursor: string | null = null) => {
  http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET').flush({ data, nextCursor });
};

const atenderResumen = (http: HttpTestingController) => {
  http.expectOne(`${BASE}/summary`).flush({ pending: 1, failed: 2, exhausted: 3 });
};

const montar = async (permisos: string[], data: DeliveryRow[] = [FILA], nextCursor: string | null = null) => {
  const http = await configurar();
  conPermisos(permisos);
  const fixture = TestBed.createComponent(DeliveriesComponent);
  atender(http, data, nextCursor);
  atenderResumen(http);
  await asentar(fixture);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const botonCon = (texto: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(texto));

const abrir = async (fixture: ComponentFixture<unknown>, http: HttpTestingController, root: HTMLElement) => {
  root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
  await asentar(fixture);
  http.expectOne(`${BASE}/d1`).flush(DETALLE);
  await asentar(fixture);
};

describe('Integraciones: entregas', () => {
  it('lista organización, evento, estado y resultado, sin llaves crudas', async () => {
    const { root, http } = await montar(['platform:operations']);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Org Uno');
    expect(texto).toContain('document.signed');
    expect(texto).toContain('Clásico');
    expect(texto).toContain('Fallida');
    expect(texto).toContain('500 · HTTP 500');
    expect(texto).not.toMatch(LLAVE_CRUDA);
    http.verify();
  });

  it('pide la primera página con el límite y sin filtros', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    TestBed.createComponent(DeliveriesComponent);
    const req = http.expectOne((r) => r.url.endsWith(BASE));
    expect(req.request.params.keys()).toEqual(['limit']);
    expect(req.request.params.get('limit')).toBe(String(DELIVERIES_LIMIT));
    req.flush({ data: [], nextCursor: null });
    atenderResumen(http);
  });

  it('muestra los abiertos en los filtros y filtra por estado', async () => {
    const { fixture, http, root } = await montar(['platform:operations']);
    const pill = [...root.querySelectorAll<HTMLButtonElement>('.pill')].find((b) =>
      b.textContent?.includes('Agotadas'),
    );
    expect(pill?.textContent).toContain('3');
    pill?.click();
    await asentar(fixture);
    const req = http.expectOne((r) => r.url.endsWith(BASE));
    expect(req.request.params.get('status')).toBe('exhausted');
    req.flush({ data: [], nextCursor: null });
    await asentar(fixture);
    expect(root.textContent).toContain('Ninguna entrega con estos filtros');
  });

  it('si el bridge no responde lo dice y deja reintentar', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(DeliveriesComponent);
    http
      .expectOne((r) => r.url.endsWith(BASE))
      .flush({ code: 'BRIDGE_NO_DISPONIBLE' }, { status: 503, statusText: 'No disponible' });
    http.expectOne(`${BASE}/summary`).flush({}, { status: 503, statusText: 'No disponible' });
    await asentar(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('El servicio de integraciones no responde');
    expect(root.textContent).toContain('Reintentar');
    expect(root.textContent).not.toMatch(LLAVE_CRUDA);
  });

  it('otro error muestra el mensaje general', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(DeliveriesComponent);
    http.expectOne((r) => r.url.endsWith(BASE)).flush({}, { status: 500, statusText: 'Error' });
    atenderResumen(http);
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No pudimos cargar las entregas');
  });

  it('sin siguiente ni anterior no muestra paginación', async () => {
    const { root } = await montar(['platform:operations']);
    expect(root.querySelector('.cursor')).toBeNull();
  });

  it('avanza y vuelve con el cursor', async () => {
    const { fixture, http, root } = await montar(['platform:operations'], [FILA], 'c2');
    expect(root.querySelector('.cursor')).not.toBeNull();
    botonCon('Página siguiente')?.click();
    await asentar(fixture);
    const siguiente = http.expectOne((r) => r.url.endsWith(BASE));
    expect(siguiente.request.params.get('cursor')).toBe('c2');
    siguiente.flush({ data: [FILA], nextCursor: null });
    await asentar(fixture);
    botonCon('Página anterior')?.click();
    await asentar(fixture);
    const anterior = http.expectOne((r) => r.url.endsWith(BASE));
    expect(anterior.request.params.has('cursor')).toBe(false);
    anterior.flush({ data: [FILA], nextCursor: 'c2' });
    await asentar(fixture);
    http.verify();
  });

  it('solo al abrir pide el detalle y muestra destino y contenido', async () => {
    const { fixture, http, root } = await montar(['platform:operations']);
    expect(root.textContent).not.toContain('visible-solo-al-abrir');
    await abrir(fixture, http, root);
    const detalle = document.querySelector('dba-delivery-detail')?.textContent ?? '';
    expect(detalle).toContain('https://cliente.example/hook');
    expect(detalle).toContain('visible-solo-al-abrir');
    expect(detalle).not.toMatch(LLAVE_CRUDA);
  });

  it('sin permiso de administrar no ofrece reenviar', async () => {
    const { fixture, http, root } = await montar(['platform:operations']);
    await abrir(fixture, http, root);
    expect(botonCon('Reenviar')).toBeUndefined();
    expect(botonCon('Cerrar')).toBeDefined();
  });

  it('avisa si el detalle no carga, sin dejar reenviar', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
    await asentar(fixture);
    http.expectOne(`${BASE}/d1`).flush({}, { status: 500, statusText: 'Error' });
    await asentar(fixture);
    expect(document.querySelector('dba-delivery-detail')?.textContent).toContain('No pudimos cargar esta entrega');
    expect(botonCon('Reenviar')?.disabled).toBe(true);
  });

  it('reenviar exige motivo, avisa el destino y actualiza la lista', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    await abrir(fixture, http, root);
    botonCon('Reenviar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('https://cliente.example/hook');
    expect(botonCon('Reenviar ahora')?.disabled).toBe(true);
    const campo = document.querySelector<HTMLInputElement>('.form input, .form textarea');
    if (!campo) throw new Error('Falta el campo de motivo');
    campo.value = 'El cliente arregló su servidor';
    campo.dispatchEvent(new Event('input'));
    await asentar(fixture);
    botonCon('Reenviar ahora')?.click();
    await asentar(fixture);
    const envio = http.expectOne(`${BASE}/d1/replay`);
    expect(envio.request.body).toEqual({ reason: 'El cliente arregló su servidor' });
    envio.flush({
      deliveryId: 'd2',
      delivered: true,
      statusCode: 200,
      exhausted: false,
      delivery: { ...DETALLE, id: 'd2', status: 'delivered' },
    });
    await asentar(fixture);
    atender(http);
    atenderResumen(http);
    await asentar(fixture);
    expect(document.querySelector('dba-delivery-detail')?.textContent).toContain('Entregada');
    http.verify();
  });

  it('una entrega que ya llegó avisa que el cliente la recibirá otra vez', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
    await asentar(fixture);
    http.expectOne(`${BASE}/d1`).flush({ ...DETALLE, status: 'delivered' });
    await asentar(fixture);
    botonCon('Reenviar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('Esta entrega ya llegó');
    expect(document.body.textContent).not.toContain('reintentos automáticos');
  });

  it('sin destino activo explica el motivo y no ofrece reenviar', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
    await asentar(fixture);
    http.expectOne(`${BASE}/d1`).flush({ ...DETALLE, destinationUrl: null });
    await asentar(fixture);
    expect(botonCon('Reenviar')).toBeUndefined();
    expect(botonCon('Cerrar')).toBeDefined();
    expect(document.body.textContent).toContain('No tiene un destino activo');
  });

  it('una organización desconocida no enlaza a ninguna ficha', async () => {
    const { fixture, http, root } = await montar(['platform:operations']);
    root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
    await asentar(fixture);
    http.expectOne(`${BASE}/d1`).flush({ ...DETALLE, organizationName: null });
    await asentar(fixture);
    expect(document.querySelector('dba-delivery-detail a.item__link')).toBeNull();
    expect(document.querySelector('dba-delivery-detail')?.textContent).toContain('Organización desconocida');
  });

  it('una fallida avisa que sus reintentos automáticos siguen', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    await abrir(fixture, http, root);
    botonCon('Reenviar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('reintentos automáticos');
  });

  it('una agotada no avisa de reintentos porque ya no le quedan', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
    await asentar(fixture);
    http.expectOne(`${BASE}/d1`).flush({ ...DETALLE, status: 'exhausted' });
    await asentar(fixture);
    botonCon('Reenviar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).not.toContain('reintentos automáticos');
  });
});

describe('Vista de las entregas', () => {
  it('arma el resultado con lo que haya', () => {
    expect(resultOf({ lastStatusCode: 200 })).toBe('200');
    expect(resultOf({ lastStatusCode: 500, lastError: 'HTTP 500' })).toBe('500 · HTTP 500');
    expect(resultOf({ lastStatusCode: null, lastError: 'ECONNREFUSED' })).toBe('ECONNREFUSED');
    expect(resultOf({})).toBe('—');
  });

  it('sin resumen los filtros siguen, sin cifras', () => {
    expect(statusPills(null).every((pill) => pill.count === undefined)).toBe(true);
    expect(statusPills({ pending: 0, failed: 1, exhausted: 0 }).find((p) => p.key === 'failed')?.danger).toBe(true);
    expect(statusPills({ pending: 0, failed: 0, exhausted: 0 }).find((p) => p.key === 'failed')?.danger).toBe(false);
  });

  it('elige el mensaje de error de reenviar', () => {
    const con = (status: number, code?: string): HttpErrorResponse =>
      new HttpErrorResponse({ status, error: { code } });
    expect(replayErrorKey(con(409, 'WEBHOOK_LEGACY_UNAVAILABLE'))).toBe('dlv.replay.error.classicOff');
    expect(replayErrorKey(con(409, 'WEBHOOK_LEGACY_DESTINATION_REMOVED'))).toBe('dlv.replay.error.classicRemoved');
    expect(replayErrorKey(con(404, 'WEBHOOK_ENDPOINT_NOT_FOUND'))).toBe('dlv.replay.error.endpointGone');
    expect(replayErrorKey(con(503, 'BRIDGE_NO_DISPONIBLE'))).toBe('dlv.replay.error.unavailable');
    expect(replayErrorKey(con(403))).toBe('dlv.replay.error.forbidden');
    expect(replayErrorKey(con(500))).toBe('dlv.replay.error.failed');
    expect(isBridgeDown(con(503))).toBe(true);
    expect(isBridgeDown(con(500))).toBe(false);
  });
});
