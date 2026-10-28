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
    expect(canSeeArea(['platform:clients'], 'organizations')).toBe(true);
    expect(canSeeArea(['platform:commercial'], 'organizations')).toBe(false);
  });

  it('cada área pide la lectura o el :manage de su grupo', () => {
    expect(ROUTE_ACCESS.organizations).toEqual(['platform:clients', 'platform:clients:manage']);
    expect(ROUTE_ACCESS.users).toEqual(ROUTE_ACCESS.organizations);
    expect(ROUTE_ACCESS.plans).toEqual(['platform:commercial', 'platform:commercial:manage']);
    expect(ROUTE_ACCESS.billing).toEqual(ROUTE_ACCESS.plans);
    expect(ROUTE_ACCESS.security).toEqual(['platform:platform', 'platform:platform:manage']);
    expect(ROUTE_ACCESS.audit).toEqual(ROUTE_ACCESS.security);
  });

  it('readonly, que no tiene Plataforma, no ve seguridad ni auditoría', () => {
    const readonly = ['platform:clients', 'platform:operations', 'platform:commercial', 'platform:catalogs'];
    expect(canSeeArea(readonly, 'organizations')).toBe(true);
    expect(canSeeArea(readonly, 'billing')).toBe(true);
    expect(canSeeArea(readonly, 'audit')).toBe(false);
    expect(canSeeArea(readonly, 'security')).toBe(false);
  });
});
