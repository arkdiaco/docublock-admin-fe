import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { HardNavigation } from '../browser/hard-navigation';
import { AppUpdate, CHECK_EVERY_MS, MIN_GAP_MS, RETRY_GUARD_MS } from './app-update.service';
import { CURRENT_BUILD, LatestBuild } from './latest-build';

const CHUNK_VIEJO = new TypeError('Failed to fetch dynamically imported module: https://app/chunk-AAAA1111.js');

const trabajador = (hayVersion: boolean) => ({
  isEnabled: true,
  versionUpdates: new Subject<VersionEvent>(),
  unrecoverable: new Subject<unknown>(),
  checkForUpdate: vi.fn(() => Promise.resolve(hayVersion)),
  activateUpdate: vi.fn(() => Promise.resolve(true)),
});

const montar = (
  current: string | null,
  latest: string | null,
  worker?: ReturnType<typeof trabajador>,
) => {
  const id = vi.fn(() => Promise.resolve(latest));
  const navigation = { to: vi.fn(), reload: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: CURRENT_BUILD, useValue: current },
      { provide: LatestBuild, useValue: { id } },
      { provide: HardNavigation, useValue: navigation },
      ...(worker ? [{ provide: SwUpdate, useValue: worker }] : []),
    ],
  });
  return { update: TestBed.inject(AppUpdate), id, navigation };
};

describe('AppUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('avisa cuando el index publicado trae otra versión y recarga al pedirlo', async () => {
    const { update, navigation } = montar('AAAA1111', 'BBBB2222');
    await update.check();
    expect(update.available()).toBe(true);
    await update.apply();
    expect(navigation.reload).toHaveBeenCalledTimes(1);
  });

  it('con la misma versión o sin respuesta no avisa, y no consulta más de una vez por minuto', async () => {
    const { update, id } = montar('AAAA1111', 'AAAA1111');
    await update.check();
    await update.check();
    expect(update.available()).toBe(false);
    expect(id).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MIN_GAP_MS);
    await update.check();
    expect(id).toHaveBeenCalledTimes(2);
  });

  it('consulta sola cada cierto tiempo y al volver a la pestaña; en desarrollo, sin huella, no hace nada', async () => {
    const { update, id } = montar('AAAA1111', 'BBBB2222');
    update.start();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(id).toHaveBeenCalledTimes(1);
    expect(update.available()).toBe(true);
    TestBed.resetTestingModule();
    const dev = montar(null, 'BBBB2222');
    dev.update.start();
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(dev.id).not.toHaveBeenCalled();
  });

  it('si una ruta pide un chunk que ya no existe, entra de nuevo a esa ruta con la versión nueva, sin bucle', () => {
    const { update, navigation } = montar('AAAA1111', 'BBBB2222');
    expect(update.recover(CHUNK_VIEJO, '/documentos/nuevo')).toBe(true);
    expect(navigation.to).toHaveBeenCalledWith('/documentos/nuevo');
    expect(update.recover(CHUNK_VIEJO, '/documentos/nuevo')).toBe(false);
    expect(navigation.to).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RETRY_GUARD_MS);
    expect(update.recover(CHUNK_VIEJO, '/documentos/nuevo')).toBe(true);
  });

  it('instalada como app, pregunta al service worker y al actualizar activa la versión nueva antes de recargar', async () => {
    const worker = trabajador(true);
    const { update, id, navigation } = montar('AAAA1111', 'AAAA1111', worker);
    await update.check();
    expect(worker.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(id).not.toHaveBeenCalled();
    expect(update.available()).toBe(true);
    await update.apply();
    expect(worker.activateUpdate).toHaveBeenCalledTimes(1);
    expect(navigation.reload).toHaveBeenCalledTimes(1);
  });

  it('el aviso también sale cuando el service worker baja la versión por su cuenta o queda en un estado irrecuperable', () => {
    const lista = trabajador(false);
    const primera = montar('AAAA1111', null, lista);
    primera.update.start();
    expect(primera.update.available()).toBe(false);
    lista.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
    expect(primera.update.available()).toBe(true);
    TestBed.resetTestingModule();
    const rota = trabajador(false);
    const segunda = montar('AAAA1111', null, rota);
    segunda.update.start();
    rota.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'sin red' });
    expect(segunda.update.available()).toBe(true);
  });

  it('si activar la versión falla, recarga igual', async () => {
    const worker = trabajador(true);
    worker.activateUpdate.mockRejectedValueOnce(new Error('sin red'));
    const { update, navigation } = montar('AAAA1111', null, worker);
    await update.apply();
    expect(navigation.reload).toHaveBeenCalledTimes(1);
  });

  it('otros errores de navegación no recargan nada', () => {
    const { update, navigation } = montar('AAAA1111', 'BBBB2222');
    expect(update.recover(new Error('guard falló'), '/panel')).toBe(false);
    expect(navigation.to).not.toHaveBeenCalled();
  });
});
