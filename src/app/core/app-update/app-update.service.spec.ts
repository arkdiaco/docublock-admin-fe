import { TestBed } from '@angular/core/testing';
import { HardNavigation } from '../browser/hard-navigation';
import { AppUpdate, CHECK_EVERY_MS, MIN_GAP_MS, RETRY_GUARD_MS } from './app-update.service';
import { CURRENT_BUILD, LatestBuild } from './latest-build';

const CHUNK_VIEJO = new TypeError('Failed to fetch dynamically imported module: https://app/chunk-AAAA1111.js');

const montar = (current: string | null, latest: string | null) => {
  const id = vi.fn(() => Promise.resolve(latest));
  const navigation = { to: vi.fn(), reload: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: CURRENT_BUILD, useValue: current },
      { provide: LatestBuild, useValue: { id } },
      { provide: HardNavigation, useValue: navigation },
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
    update.apply();
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

  it('otros errores de navegación no recargan nada', () => {
    const { update, navigation } = montar('AAAA1111', 'BBBB2222');
    expect(update.recover(new Error('guard falló'), '/panel')).toBe(false);
    expect(navigation.to).not.toHaveBeenCalled();
  });
});
