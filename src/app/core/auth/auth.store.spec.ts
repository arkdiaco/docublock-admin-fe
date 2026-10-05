import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';

const token = (payload: object): string => {
  const b64 = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
};

const usuario = {
  id: 'u1',
  names: 'Ada',
  surNames: 'Lovelace',
  email: 'ada@docublock.test',
  identification: '1001',
  imageProfile: null,
};

describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(AuthStore);
  });

  it('arranca sin sesión ni personal de plataforma', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.platformStaff()).toBe(false);
    expect(store.platformPermissions()).toEqual([]);
  });

  it('antes de cargar el perfil, el flag de plataforma sale del token', () => {
    store.setTokens({ accessToken: token({ sub: 'u1', platformStaff: true }), refreshToken: 'r' });
    expect(store.platformStaff()).toBe(true);
    store.setTokens({ accessToken: token({ sub: 'u1' }), refreshToken: 'r' });
    expect(store.platformStaff()).toBe(false);
  });

  it('el perfil manda sobre el token', () => {
    store.setTokens({ accessToken: token({ sub: 'u1', platformStaff: true }), refreshToken: 'r' });
    store.setProfile({ user: usuario, platformStaff: false, platformPermissions: [] });
    expect(store.platformStaff()).toBe(false);
    expect(store.profileLoaded()).toBe(true);
  });

  it('no revienta con un token ilegible', () => {
    store.setTokens({ accessToken: 'esto-no-es-un-jwt', refreshToken: 'r' });
    expect(store.platformStaff()).toBe(false);
  });

  it('los permisos de plataforma se consultan uno a uno o por cualquiera', () => {
    store.setProfile({ user: usuario, platformStaff: true, platformPermissions: ['platform:orgs:read'] });
    expect(store.hasPlatformPermission('platform:orgs:read')).toBe(true);
    expect(store.hasPlatformPermission('platform:orgs:manage')).toBe(false);
    expect(store.hasAnyPlatformPermission(['platform:orgs:manage', 'platform:orgs:read'])).toBe(true);
    expect(store.hasAnyPlatformPermission(['platform:orgs:manage'])).toBe(false);
  });

  it('calcula iniciales y nombre a mostrar', () => {
    store.setProfile({ user: usuario, platformStaff: true, platformPermissions: [] });
    expect(store.initials()).toBe('AL');
    expect(store.displayName()).toBe('Ada Lovelace');
  });

  it('al limpiar se lleva también lo persistido', () => {
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    store.setProfile({ user: usuario, platformStaff: true, platformPermissions: ['x'] });
    store.clear();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.platformStaff()).toBe(false);
    expect(store.platformPermissions()).toEqual([]);
    expect(localStorage.getItem('dba.session')).toBeNull();
  });

  it('rehidrata los tokens guardados al arrancar', () => {
    localStorage.setItem('dba.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const otro = TestBed.inject(AuthStore);
    expect(otro.isAuthenticated()).toBe(true);
    expect(otro.refreshTokenValue()).toBe('r');
  });
});
