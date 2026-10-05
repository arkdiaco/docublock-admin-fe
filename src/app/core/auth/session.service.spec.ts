import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthStore } from './auth.store';
import { NotPlatformStaffError, SessionService } from './session.service';

const sesion = { accessToken: 'acceso', refreshToken: 'refresco', sid: 's1', expiresIn: 900 };
const yo = (platformStaff: boolean, roleCode = 1) => ({
  user: { id: 'u1', names: 'Ada', surNames: 'Lovelace', email: 'ada@docublock.test', identification: '1001' },
  permissions: [],
  memberships: [{ organizationId: 'o1', organizationName: 'Docublock', roleCode, active: true }],
  platformStaff,
  platformPermissions: platformStaff ? ['platform:orgs:read'] : [],
});

const respira = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('SessionService', () => {
  let http: HttpTestingController;
  let store: AuthStore;
  let service: SessionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), MessageService],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    service = TestBed.inject(SessionService);
  });

  afterEach(() => http.verify());

  it('pedir el código va sin sesión y en silencio', async () => {
    const pedido = service.requestCode('1001');
    const req = http.expectOne('/auth/request-otp');
    expect(req.request.body).toEqual({ identification: '1001', resend: false });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ sent: true });
    await pedido;
  });

  it('entrar con el código guarda los tokens, carga el perfil y marca el personal de plataforma', async () => {
    const entrada = service.loginWithCode('1001', '123456');
    http.expectOne('/auth/login').flush(sesion);
    await respira();
    http.expectOne('/auth/me').flush(yo(true));
    await entrada;
    expect(store.accessToken()).toBe('acceso');
    expect(store.platformStaff()).toBe(true);
    expect(store.platformPermissions()).toEqual(['platform:orgs:read']);
    expect(store.displayName()).toBe('Ada Lovelace');
  });

  it('un usuario que no es de plataforma entra al core pero aquí se le cierra la sesión', async () => {
    const entrada = service.loginWithCode('1001', '123456');
    http.expectOne('/auth/login').flush(sesion);
    await respira();
    http.expectOne('/auth/me').flush(yo(false));
    await respira();
    http.expectOne('/auth/logout').flush({ loggedOut: true });
    await expect(entrada).rejects.toBeInstanceOf(NotPlatformStaffError);
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('dba.session')).toBeNull();
  });

  it('mientras el core derive el personal del rol código 0, una membresía con ese código también vale', async () => {
    const entrada = service.loginWithCode('1001', '123456');
    http.expectOne('/auth/login').flush(sesion);
    await respira();
    http.expectOne('/auth/me').flush({ ...yo(false, 0), platformStaff: undefined });
    await entrada;
    expect(store.platformStaff()).toBe(true);
  });

  it('al arrancar con token guardado recarga el perfil; si ya no es de plataforma, limpia', async () => {
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    const restauro = service.restore();
    http.expectOne('/auth/me').flush(yo(false));
    await restauro;
    expect(store.isAuthenticated()).toBe(false);
  });

  it('al arrancar sin token no llama a nada', async () => {
    await service.restore();
    http.expectNone('/auth/me');
  });

  it('cerrar sesión avisa al core, limpia y vuelve al acceso', async () => {
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const salida = service.logout();
    expect(service.leaving()).toBe(true);
    http.expectOne('/auth/logout').flush({ loggedOut: true });
    await salida;
    expect(store.isAuthenticated()).toBe(false);
    expect(ir).toHaveBeenCalledWith(['/acceso']);
    expect(service.leaving()).toBe(false);
  });
});
