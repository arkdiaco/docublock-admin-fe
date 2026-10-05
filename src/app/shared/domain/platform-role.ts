export type PlatformRole = 'superadmin' | 'support' | 'orgAdmin' | 'readonly';

export interface PlatformRoleView {
  key: PlatformRole;
  labelKey: string;
  descKey: string;
}

export const PLATFORM_ROLES: readonly PlatformRoleView[] = [
  { key: 'superadmin', labelKey: 'role.superadmin', descKey: 'role.desc.superadmin' },
  { key: 'support', labelKey: 'role.support', descKey: 'role.desc.support' },
  { key: 'orgAdmin', labelKey: 'role.orgAdmin', descKey: 'role.desc.orgAdmin' },
  { key: 'readonly', labelKey: 'role.readonly', descKey: 'role.desc.readonly' },
];

export const platformRoleOf = (key: string): PlatformRoleView =>
  PLATFORM_ROLES.find((role) => role.key === key) ?? PLATFORM_ROLES[PLATFORM_ROLES.length - 1];
