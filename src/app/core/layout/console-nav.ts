import { canManageGroup, canReadGroup, platformManage, platformRead, type PlatformGroup } from '../../shared/domain/platform-permissions';

export type ConsoleSection =
  | 'organizations'
  | 'users'
  | 'signers'
  | 'legalEntities'
  | 'documents'
  | 'support'
  | 'integrations'
  | 'tasks'
  | 'plans'
  | 'subscriptions'
  | 'marketplace'
  | 'promotions'
  | 'referrals'
  | 'resellers'
  | 'billing'
  | 'countries'
  | 'policies'
  | 'communications'
  | 'staff'
  | 'audit'
  | 'settings'
  | 'health';

export interface ConsoleItem {
  key: ConsoleSection;
  path: string;
  labelKey: string;
  manage?: boolean;
}

export interface ConsoleGroup {
  key: PlatformGroup;
  path: string;
  labelKey: string;
  items: readonly ConsoleItem[];
}

export const OVERVIEW_PATH = 'panel';

export const CONSOLE_GROUPS: readonly ConsoleGroup[] = [
  {
    key: 'clients',
    path: 'clientes',
    labelKey: 'nav.group.clients',
    items: [
      { key: 'organizations', path: 'organizaciones', labelKey: 'nav.organizations' },
      { key: 'users', path: 'usuarios', labelKey: 'nav.users' },
      { key: 'signers', path: 'firmantes', labelKey: 'nav.signers' },
      { key: 'legalEntities', path: 'juridicas', labelKey: 'nav.legalEntities' },
    ],
  },
  {
    key: 'operations',
    path: 'operacion',
    labelKey: 'nav.group.operations',
    items: [
      { key: 'documents', path: 'documentos', labelKey: 'nav.documents' },
      { key: 'support', path: 'soporte', labelKey: 'nav.support' },
      { key: 'integrations', path: 'integraciones', labelKey: 'nav.integrations' },
      { key: 'tasks', path: 'tareas', labelKey: 'nav.tasks' },
    ],
  },
  {
    key: 'commercial',
    path: 'comercial',
    labelKey: 'nav.group.commercial',
    items: [
      { key: 'plans', path: 'planes', labelKey: 'nav.plans' },
      { key: 'subscriptions', path: 'suscripciones', labelKey: 'nav.subscriptions' },
      { key: 'marketplace', path: 'marketplace', labelKey: 'nav.marketplace' },
      { key: 'promotions', path: 'promocionales', labelKey: 'nav.promotions' },
      { key: 'referrals', path: 'referidos', labelKey: 'nav.referrals' },
      { key: 'resellers', path: 'resellers', labelKey: 'nav.resellers' },
      { key: 'billing', path: 'facturacion', labelKey: 'nav.billing' },
    ],
  },
  {
    key: 'catalogs',
    path: 'catalogos',
    labelKey: 'nav.group.catalogs',
    items: [
      { key: 'countries', path: 'paises', labelKey: 'nav.countries' },
      { key: 'policies', path: 'politicas', labelKey: 'nav.policies' },
      { key: 'communications', path: 'comunicaciones', labelKey: 'nav.communications' },
    ],
  },
  {
    key: 'platform',
    path: 'plataforma',
    labelKey: 'nav.group.platform',
    items: [
      { key: 'staff', path: 'personal', labelKey: 'nav.staff', manage: true },
      { key: 'audit', path: 'auditoria', labelKey: 'nav.audit' },
      { key: 'settings', path: 'configuracion', labelKey: 'nav.settings' },
      { key: 'health', path: 'salud', labelKey: 'nav.health' },
    ],
  },
];

export const LEGACY_REDIRECTS: readonly (readonly [string, string])[] = [
  ['organizaciones', '/clientes/organizaciones'],
  ['organizaciones/:id', '/clientes/organizaciones/:id'],
  ['usuarios', '/clientes/usuarios'],
  ['planes', '/comercial/planes'],
  ['facturacion', '/comercial/facturacion'],
  ['seguridad', '/plataforma/configuracion'],
  ['auditoria', '/plataforma/auditoria'],
  ['sistema', '/plataforma/salud'],
  ['estado', '/plataforma/salud'],
];

export const groupAccess = (group: PlatformGroup): readonly string[] => [platformRead(group), platformManage(group)];

export const itemAccess = (group: ConsoleGroup, item: ConsoleItem): readonly string[] =>
  item.manage ? [platformManage(group.key)] : groupAccess(group.key);

export const canSeeItem = (owned: readonly string[], group: ConsoleGroup, item: ConsoleItem): boolean =>
  item.manage ? canManageGroup(owned, group.key) : canReadGroup(owned, group.key);

export const visibleGroups = (owned: readonly string[]): ConsoleGroup[] =>
  CONSOLE_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canSeeItem(owned, group, item)) })).filter(
    (group) => group.items.length > 0,
  );

const locate = (key: ConsoleSection): { group: ConsoleGroup; item: ConsoleItem } => {
  for (const group of CONSOLE_GROUPS) {
    const item = group.items.find((candidate) => candidate.key === key);
    if (item) return { group, item };
  }
  throw new Error(`Sección desconocida: ${key}`);
};

export const sectionPath = (key: ConsoleSection): string => {
  const { group, item } = locate(key);
  return `/${group.path}/${item.path}`;
};

export const canSeeSection = (owned: readonly string[], key: ConsoleSection): boolean => {
  const { group, item } = locate(key);
  return canSeeItem(owned, group, item);
};
