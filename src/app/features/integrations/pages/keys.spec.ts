import { HttpErrorResponse } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { conPermisos, configurar } from '../../catalogs/pages/catalogs-test-kit';
import { actionErrorKey } from '../data/integrations.api';
import type { KeyRow } from '../data/integrations.models';
import { canRevoke, keyPills, keyStateOf } from '../data/key-view';
import { KEYS_LIMIT, KeysComponent } from './keys.component';

const LLAVE_CRUDA = /\b(ikey|integ|dlv|nav|common|sub)\.[a-zA-Z]/;
const BASE = '/platform/integrations/keys';

const FILA: KeyRow = {
  id: 'k1',
  organizationId: '6a979ef858233f68f8ba543a',
  organizationName: 'Org Uno',
  name: 'ERP',
  prefix: 'dbk_live_abcd1234',
  scopes: ['documents:read', 'titles:read'],
  state: 'active',
  expiresAt: '2026-11-20T10:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

const asentar = async (fixture: ComponentFixture<unknown>): Promise<void> => {
  await fixture.whenStable();
  fixture.detectChanges();
};

const atender = (http: HttpTestingController, data: KeyRow[] = [FILA], nextCursor: string | null = null) => {
  http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET').flush({ data, nextCursor });
};

const montar = async (permisos: string[], data: KeyRow[] = [FILA], nextCursor: string | null = null) => {
  const http = await configurar();
  conPermisos(permisos);
  const fixture = TestBed.createComponent(KeysComponent);
  atender(http, data, nextCursor);
  http.expectOne(`${BASE}/summary`).flush({ expiring: 1, unused: 2, expired: 3 });
  await asentar(fixture);
  return { fixture, http, root: fixture.nativeElement as HTMLElement };
};

const botonCon = (texto: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim().startsWith(texto));

const abrir = async (fixture: ComponentFixture<unknown>, root: HTMLElement) => {
  root.querySelector<HTMLButtonElement>('button.bl-row')?.click();
  await asentar(fixture);
};

describe('Integraciones: claves', () => {
  it('lista organización, clave, estado y uso, sin llaves crudas', async () => {
    const { root } = await montar(['platform:operations']);
    const texto = root.textContent ?? '';
    expect(texto).toContain('Org Uno');
    expect(texto).toContain('dbk_live_abcd1234');
    expect(texto).toContain('Activa');
    expect(texto).toContain('Sin uso');
    expect(texto).toContain('Por vencer');
    expect(texto).not.toMatch(LLAVE_CRUDA);
  });

  it('filtra y pide con el límite', async () => {
    const { fixture, http } = await montar(['platform:operations']);
    botonCon('Vencidas')?.click();
    await asentar(fixture);
    const pedido = http.expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET');
    expect(pedido.request.params.get('filter')).toBe('expired');
    expect(pedido.request.params.get('limit')).toBe(String(KEYS_LIMIT));
    pedido.flush({ data: [], nextCursor: null });
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ninguna clave con estos filtros');
  });

  it('avisa si el servicio no responde', async () => {
    const http = await configurar();
    conPermisos(['platform:operations']);
    const fixture = TestBed.createComponent(KeysComponent);
    http
      .expectOne((req) => req.url.endsWith(BASE) && req.method === 'GET')
      .flush({}, { status: 503, statusText: 'No disponible' });
    http.expectOne(`${BASE}/summary`).flush({}, { status: 503, statusText: 'No disponible' });
    await asentar(fixture);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('El servicio de integraciones no responde');
  });

  it('sin permiso de administrar no ofrece revocar', async () => {
    const { fixture, root } = await montar(['platform:operations']);
    await abrir(fixture, root);
    expect(botonCon('Revocar')).toBeUndefined();
    expect(botonCon('Cerrar')).toBeDefined();
    expect(document.querySelector('dba-key-detail')?.textContent).toContain('documents:read, titles:read');
  });

  it('una revocada no ofrece revocar otra vez', async () => {
    const { fixture, root } = await montar(['platform:operations:manage'], [{ ...FILA, state: 'revoked' }]);
    await abrir(fixture, root);
    expect(botonCon('Revocar')).toBeUndefined();
  });

  it('revoca con motivo tras avisar del efecto', async () => {
    const { fixture, http, root } = await montar(['platform:operations:manage']);
    await abrir(fixture, root);
    botonCon('Revocar')?.click();
    await asentar(fixture);
    expect(document.body.textContent).toContain('dejará de funcionar de inmediato');
    expect(botonCon('Revocar ahora')?.disabled).toBe(true);
    const campo = document.querySelector<HTMLInputElement>('.form input, .form textarea');
    if (!campo) throw new Error('Falta el campo de motivo');
    campo.value = 'Clave filtrada';
    campo.dispatchEvent(new Event('input'));
    await asentar(fixture);
    botonCon('Revocar ahora')?.click();
    const envio = http.expectOne(`${BASE}/k1/revoke`);
    expect(envio.request.body).toEqual({ reason: 'Clave filtrada' });
    envio.flush({ ...FILA, state: 'revoked' });
    await asentar(fixture);
    atender(http);
    http.expectOne(`${BASE}/summary`).flush({ expiring: 0, unused: 0, expired: 0 });
    await asentar(fixture);
    expect(document.querySelector('dba-key-revoke-confirm')).toBeNull();
  });
});

describe('Vista de las claves', () => {
  it('solo se revoca una clave que aún sirve', () => {
    expect(canRevoke({ state: 'active' })).toBe(true);
    expect(canRevoke({ state: 'rotating' })).toBe(true);
    expect(canRevoke({ state: 'expired' })).toBe(false);
    expect(canRevoke({ state: 'revoked' })).toBe(false);
  });

  it('traduce el estado y los conteos', () => {
    expect(keyStateOf('revoked')).toBe('closed');
    expect(keyPills({ expiring: 2, unused: 0, expired: 1 })[1]).toMatchObject({ count: 2, danger: true });
    expect(keyPills(null)[1].count).toBeUndefined();
  });

  it('elige el mensaje de error', () => {
    const con = (status: number): HttpErrorResponse => new HttpErrorResponse({ status });
    expect(actionErrorKey(con(503), 'ikey.revoke.error')).toBe('dlv.replay.error.unavailable');
    expect(actionErrorKey(con(403), 'ikey.revoke.error')).toBe('ikey.revoke.error.forbidden');
    expect(actionErrorKey(con(404), 'ikey.revoke.error')).toBe('ikey.revoke.error.gone');
    expect(actionErrorKey(con(500), 'ikey.revoke.error')).toBe('ikey.revoke.error.failed');
  });
});
