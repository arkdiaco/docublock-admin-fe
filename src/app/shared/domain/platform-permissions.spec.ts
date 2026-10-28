import { PLATFORM_GROUPS, canManageGroup, canReadGroup, platformManage, platformRead } from './platform-permissions';

describe('permisos de plataforma por grupo', () => {
  it('cada grupo tiene su código de lectura y su :manage, iguales a los del core', () => {
    expect(PLATFORM_GROUPS.flatMap((group) => [platformRead(group), platformManage(group)])).toEqual([
      'platform:clients',
      'platform:clients:manage',
      'platform:operations',
      'platform:operations:manage',
      'platform:commercial',
      'platform:commercial:manage',
      'platform:catalogs',
      'platform:catalogs:manage',
      'platform:platform',
      'platform:platform:manage',
    ]);
  });

  it('leer basta con la lectura; escribir exige :manage', () => {
    expect(canReadGroup(['platform:clients'], 'clients')).toBe(true);
    expect(canManageGroup(['platform:clients'], 'clients')).toBe(false);
    expect(canManageGroup(['platform:clients', 'platform:clients:manage'], 'clients')).toBe(true);
    expect(canReadGroup(['platform:clients:manage'], 'clients')).toBe(true);
    expect(canReadGroup(['platform:clients'], 'platform')).toBe(false);
  });
});
