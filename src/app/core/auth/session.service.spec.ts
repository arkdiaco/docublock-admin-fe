import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthStore } from './auth.store';
import { NotPlatformStaffError, SessionService } from './session.service';

const sesion = { accessToken: 'acceso', refreshToken: 'refresco', sid: 's1', expiresIn: 900 };
const yo = (platformStaff: boolean) => ({
  user: { id: 'a1', names: 'Ada', surNames: 'Lovelace', email: 'ada@docublock.co', identification: '' },
  permissions: [],
  memberships: [],
  platformStaff,
  platformPermissions: platformStaff ? ['platform:clients', 'platform:platform'] : [],
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

  it('pedir el código va por el acceso de plataforma, por correo, sin sesión y en silencio', async () => {
    const pedido = service.requestCode('ADA@docublock.co');
    const req = http.expectOne('/platform/auth/request-otp');
    expect(req.request.body).toEqual({ email: 'ADA@docublock.co', resend: false });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ sent: true, channel: 'ad*@docublock.co', resendAfterSeconds: 60 });
    const result = await pedido;
    expect(result.channel).toBe('ad*@docublock.co');
  });

  it('entrar con el código guarda los tokens, carga el perfil y marca el personal de plataforma', async () => {
    const entrada = service.loginWithCode('ada@docublock.co', '123456');
    const login = http.expectOne('/platform/auth/login');
    expect(login.request.body).toEqual({ email: 'ada@docublock.co', code: '123456' });
    login.flush(sesion);
    await respira();
    http.expectOne('/platform/auth/me').flush(yo(true));
    await entrada;
    expect(store.accessToken()).toBe('acceso');
    expect(store.platformStaff()).toBe(true);
    expect(store.platformPermissions()).toEqual(['platform:clients', 'platform:platform']);
    expect(store.displayName()).toBe('Ada Lovelace');
  });

  it('si el perfil no es de plataforma se cierra la sesión', async () => {
    const entrada = service.loginWithCode('ada@docublock.co', '123456');
    http.expectOne('/platform/auth/login').flush(sesion);
    await respira();
    http.expectOne('/platform/auth/me').flush(yo(false));
    await respira();
    http.expectOne('/platform/auth/logout').flush({ loggedOut: true });
    await expect(entrada).rejects.toBeInstanceOf(NotPlatformStaffError);
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('dba.session')).toBeNull();
  });

  it('al arrancar con token guardado recarga el perfil; si ya no es de plataforma, limpia', async () => {
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    const restauro = service.restore();
    http.expectOne('/platform/auth/me').flush(yo(false));
    await restauro;
    expect(store.isAuthenticated()).toBe(false);
  });

  it('al arrancar sin token no llama a nada', async () => {
    await service.restore();
    http.expectNone('/platform/auth/me');
  });

  it('cerrar sesión avisa al core, limpia y vuelve al acceso', async () => {
    store.setTokens({ accessToken: 'a', refreshToken: 'r' });
    const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const salida = service.logout();
    expect(service.leaving()).toBe(true);
    http.expectOne('/platform/auth/logout').flush({ loggedOut: true });
    await salida;
    expect(store.isAuthenticated()).toBe(false);
    expect(ir).toHaveBeenCalledWith(['/acceso']);
    expect(service.leaving()).toBe(false);
  });
});
