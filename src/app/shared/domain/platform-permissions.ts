export const PLATFORM_GROUPS = ['clients', 'operations', 'commercial', 'intelligence', 'catalogs', 'platform'] as const;

export type PlatformGroup = (typeof PLATFORM_GROUPS)[number];

export const platformRead = (group: PlatformGroup): string => `platform:${group}`;

export const platformManage = (group: PlatformGroup): string => `platform:${group}:manage`;

export const canReadGroup = (owned: readonly string[], group: PlatformGroup): boolean =>
  owned.includes(platformRead(group)) || owned.includes(platformManage(group));

export const canManageGroup = (owned: readonly string[], group: PlatformGroup): boolean =>
  owned.includes(platformManage(group));
