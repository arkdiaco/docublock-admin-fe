import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter, type UrlSegment } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { AuthStore } from './auth.store';
import { authGuard, guestGuard, platformMatchGuard, platformPermissionGuard } from './auth.guards';

const segmentos = (...paths: string[]): UrlSegment[] =>
  paths.map((path) => ({ path, parameters: {} }) as UrlSegment);

const usuario = { id: 'u1', names: 'Ada', surNames: 'Lovelace', email: 'a@b.co', identification: '1', imageProfile: null };

describe('guards de acceso', () => {
  let store: AuthStore;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), MessageService, provideTranslateService({ fallbackLang: 'es' })],
    });
    store = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  it('authGuard manda al acceso y conserva el destino cuando no hay sesión', () => {
    const resultado = TestBed.runInInjectionContext(() => authGuard({} as never, segmentos('organizaciones', '42')));
    expect(resultado).toBeInstanceOf(UrlTree);
    const url = router.serializeUrl(resultado as UrlTree);
    expect(url).toContain('/acceso');
    expect(url).toContain('redirect=%2Forganizaciones%2F42');
  });

  it('authGuard rechaza una sesión que no es de plataforma aunque tenga token', () => {
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    store.setProfile({ user: usuario, platformStaff: false, platformPermissions: [] });
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, segmentos('x')))).toBeInstanceOf(UrlTree);
  });

  it('authGuard deja pasar al personal de plataforma', () => {
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    store.setProfile({ user: usuario, platformStaff: true, platformPermissions: [] });
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, segmentos('x')))).toBe(true);
  });

  it('guestGuard manda al panel si ya hay sesión de plataforma y deja pasar si no', () => {
    expect(TestBed.runInInjectionContext(() => guestGuard({} as never, []))).toBe(true);
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    store.setProfile({ user: usuario, platformStaff: true, platformPermissions: [] });
    const resultado = TestBed.runInInjectionContext(() => guestGuard({} as never, []));
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/panel');
  });

  it('los guards de permiso dejan entrar con cualquiera de los permisos pedidos y, si no, avisan y mandan al panel', () => {
    store.setProfile({ user: usuario, platformStaff: true, platformPermissions: ['platform:orgs:read'] });
    const ruta = (platform?: string[]) => ({ data: platform ? { platform } : {} }) as never;
    expect(TestBed.runInInjectionContext(() => platformPermissionGuard(ruta(), {} as never))).toBe(true);
    expect(TestBed.runInInjectionContext(() => platformPermissionGuard(ruta(['platform:orgs:manage', 'platform:orgs:read']), {} as never))).toBe(true);
    const aviso = vi.spyOn(TestBed.inject(MessageService), 'add');
    const resultado = TestBed.runInInjectionContext(() => platformPermissionGuard(ruta(['platform:staff:manage']), {} as never));
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/panel');
    expect(aviso).toHaveBeenCalled();
    expect(TestBed.runInInjectionContext(() => platformMatchGuard(ruta(['platform:staff:manage']), []))).toBeInstanceOf(UrlTree);
    expect(TestBed.runInInjectionContext(() => platformMatchGuard(ruta(['platform:orgs:read']), []))).toBe(true);
  });
});
