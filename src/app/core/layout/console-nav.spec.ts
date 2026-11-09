import { CONSOLE_GROUPS, LEGACY_REDIRECTS, canSeeSection, itemAccess, itemHref, sectionPath, visibleGroups } from './console-nav';

const SUPERADMIN = [
  'platform:clients',
  'platform:clients:manage',
  'platform:operations',
  'platform:operations:manage',
  'platform:commercial',
  'platform:commercial:manage',
  'platform:intelligence',
  'platform:intelligence:manage',
  'platform:catalogs',
  'platform:catalogs:manage',
  'platform:platform',
  'platform:platform:manage',
];
const SUPPORT = [
  'platform:clients',
  'platform:clients:manage',
  'platform:operations',
  'platform:operations:manage',
  'platform:commercial',
  'platform:intelligence',
  'platform:catalogs',
  'platform:platform',
];
const READONLY = [
  'platform:clients',
  'platform:operations',
  'platform:commercial',
  'platform:intelligence',
  'platform:catalogs',
];

describe('menú de la consola', () => {
  it('son los seis grupos, con sus secciones en orden', () => {
    expect(CONSOLE_GROUPS.map((group) => [group.path, group.items.map((item) => item.path)])).toEqual([
      ['clientes', ['organizaciones', 'usuarios', 'firmantes', 'juridicas']],
      ['operacion', ['documentos', 'soporte', 'integraciones', 'envios-codigos', 'tareas']],
      ['comercial', ['planes', 'suscripciones', 'marketplace', 'promocionales', 'referidos', 'resellers', 'facturacion']],
      [
        'inteligencia',
        ['analitica', 'ingresos', 'consumo-validaciones', 'historico-validaciones', 'documentos-reseller', 'tratamiento-datos'],
      ],
      ['catalogos', ['paises', 'ciudades', 'tipos-persona', 'tipos-identificacion', 'campos-firmante', 'inmuebles', 'politicas', 'comunicaciones']],
      ['plataforma', ['personal', 'auditoria', 'configuracion', 'salud']],
    ]);
    const keys = CONSOLE_GROUPS.flatMap((group) => group.items.map((item) => item.labelKey));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cada sección pide la lectura o el :manage de su grupo; Personal solo :manage', () => {
    const [clients, , , , , platform] = CONSOLE_GROUPS;
    expect(itemAccess(clients, clients.items[0])).toEqual(['platform:clients', 'platform:clients:manage']);
    expect(itemAccess(platform, platform.items[0])).toEqual(['platform:platform:manage']);
  });

  it('superadmin ve todo', () => {
    expect(visibleGroups(SUPERADMIN).flatMap((group) => group.items).length).toBe(34);
  });

  it('support ve los seis grupos, pero Plataforma sin Personal', () => {
    const groups = visibleGroups(SUPPORT);
    expect(groups.map((group) => group.key)).toEqual([
      'clients',
      'operations',
      'commercial',
      'intelligence',
      'catalogs',
      'platform',
    ]);
    expect(groups.at(-1)?.items.map((item) => item.key)).toEqual(['audit', 'settings', 'health']);
  });

  it('readonly ve cinco grupos y nunca Plataforma', () => {
    expect(visibleGroups(READONLY).map((group) => group.key)).toEqual([
      'clients',
      'operations',
      'commercial',
      'intelligence',
      'catalogs',
    ]);
    expect(canSeeSection(READONLY, 'audit')).toBe(false);
    expect(canSeeSection(READONLY, 'organizations')).toBe(true);
  });

  it('Ingresos en Inteligencia lleva a Facturación y pide también leer Comercial', () => {
    const intelligence = CONSOLE_GROUPS.find((group) => group.key === 'intelligence')!;
    const revenue = intelligence.items.find((item) => item.key === 'revenue')!;
    expect(itemHref(intelligence, revenue)).toBe(`${sectionPath('billing')}/ingresos`);
    expect(itemHref(intelligence, intelligence.items[0])).toBe('/inteligencia/analitica');
    const soloInteligencia = visibleGroups(['platform:intelligence']);
    expect(soloInteligencia.map((group) => group.key)).toEqual(['intelligence']);
    expect(soloInteligencia[0].items.map((item) => item.key)).not.toContain('revenue');
    expect(visibleGroups(['platform:commercial']).map((group) => group.key)).toEqual(['commercial']);
  });

  it('sin permisos no queda ningún grupo', () => {
    expect(visibleGroups([])).toEqual([]);
  });

  it('las rutas de antes caen en su sección nueva', () => {
    expect(sectionPath('organizations')).toBe('/clientes/organizaciones');
    expect(sectionPath('audit')).toBe('/plataforma/auditoria');
    const destinos = new Map(LEGACY_REDIRECTS);
    expect(destinos.get('organizaciones')).toBe(sectionPath('organizations'));
    expect(destinos.get('organizaciones/:id')).toBe('/clientes/organizaciones/:id');
    expect(destinos.get('auditoria')).toBe(sectionPath('audit'));
    expect(destinos.get('facturacion')).toBe(sectionPath('billing'));
    expect(destinos.get('sistema')).toBe(sectionPath('health'));
  });
});
