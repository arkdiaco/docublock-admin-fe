import { PLATFORM_ROLES, platformRoleOf } from './platform-role';

describe('roles de plataforma', () => {
  it('son cuatro y cada uno tiene rótulo y descripción propios', () => {
    expect(PLATFORM_ROLES.map((r) => r.key)).toEqual(['superadmin', 'support', 'orgAdmin', 'readonly']);
    for (const role of PLATFORM_ROLES) {
      expect(role.labelKey).toBe(`role.${role.key}`);
      expect(role.descKey).toBe(`role.desc.${role.key}`);
    }
  });

  it('un rol desconocido cae en lectura, nunca en superadmin', () => {
    expect(platformRoleOf('superadmin').key).toBe('superadmin');
    expect(platformRoleOf('inventado').key).toBe('readonly');
  });
});
