import { CONSOLE_ENTRIES, ROUTE_ACCESS, canSeeArea } from './console-nav';

describe('entradas de la consola', () => {
  it('son las ocho del diseño, en su orden, con rutas y llaves únicas', () => {
    expect(CONSOLE_ENTRIES.map((e) => e.path)).toEqual([
      'panel',
      'organizaciones',
      'usuarios',
      'planes',
      'facturacion',
      'seguridad',
      'auditoria',
      'sistema',
    ]);
    expect(new Set(CONSOLE_ENTRIES.map((e) => e.labelKey)).size).toBe(8);
  });

  it('visión general y sistema son de cualquier personal; el resto exige su permiso de plataforma', () => {
    expect(ROUTE_ACCESS.overview).toEqual([]);
    expect(ROUTE_ACCESS.system).toEqual([]);
    expect(canSeeArea([], 'overview')).toBe(true);
    expect(canSeeArea([], 'organizations')).toBe(false);
    expect(canSeeArea(['platform:organizations'], 'organizations')).toBe(true);
    expect(canSeeArea(['platform:users'], 'organizations')).toBe(false);
  });
});
