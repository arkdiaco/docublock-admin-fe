export type ConsoleArea = 'overview' | 'organizations' | 'users' | 'plans' | 'billing' | 'security' | 'audit' | 'system';

export interface ConsoleEntry {
  key: ConsoleArea;
  path: string;
  labelKey: string;
  platform: readonly string[];
}

export const ROUTE_ACCESS: Record<ConsoleArea, readonly string[]> = {
  overview: [],
  organizations: ['platform:organizations'],
  users: ['platform:users'],
  plans: ['platform:plans'],
  billing: ['platform:billing'],
  security: ['platform:security'],
  audit: ['platform:audit'],
  system: [],
};

export const CONSOLE_ENTRIES: readonly ConsoleEntry[] = [
  { key: 'overview', path: 'panel', labelKey: 'nav.overview', platform: ROUTE_ACCESS.overview },
  { key: 'organizations', path: 'organizaciones', labelKey: 'nav.organizations', platform: ROUTE_ACCESS.organizations },
  { key: 'users', path: 'usuarios', labelKey: 'nav.users', platform: ROUTE_ACCESS.users },
  { key: 'plans', path: 'planes', labelKey: 'nav.plans', platform: ROUTE_ACCESS.plans },
  { key: 'billing', path: 'facturacion', labelKey: 'nav.billing', platform: ROUTE_ACCESS.billing },
  { key: 'security', path: 'seguridad', labelKey: 'nav.security', platform: ROUTE_ACCESS.security },
  { key: 'audit', path: 'auditoria', labelKey: 'nav.audit', platform: ROUTE_ACCESS.audit },
  { key: 'system', path: 'sistema', labelKey: 'nav.system', platform: ROUTE_ACCESS.system },
];

export const canSeeArea = (owned: readonly string[], area: ConsoleArea): boolean => {
  const required = ROUTE_ACCESS[area];
  return required.length === 0 || required.some((code) => owned.includes(code));
};
