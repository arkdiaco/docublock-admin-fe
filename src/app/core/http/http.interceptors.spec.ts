import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthStore } from '../auth/auth.store';
import { API_BASE_URL } from '../config/api.tokens';
import { NotificationService } from '../ui/notification.service';
import { SILENT_ERRORS, SKIP_AUTH, authInterceptor, baseUrlInterceptor, errorInterceptor } from './http.interceptors';

const BASE = 'http://api.test/api/core';

describe('interceptores http', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let store: AuthStore;
  let notify: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MessageService,
        provideHttpClient(withInterceptors([baseUrlInterceptor, authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    notify = TestBed.inject(NotificationService);
  });

  afterEach(() => httpMock.verify());

  it('antepone la base del API a las rutas relativas, con o sin barra', () => {
    http.get('/organizaciones').subscribe();
    httpMock.expectOne(`${BASE}/organizaciones`).flush({});
    http.get('organizaciones').subscribe();
    httpMock.expectOne(`${BASE}/organizaciones`).flush({});
  });

  it('no toca las URL absolutas ni los assets locales', () => {
    http.get('https://otro.test/cosa').subscribe();
    httpMock.expectOne('https://otro.test/cosa').flush({});
    http.get('/i18n/es.json').subscribe();
    httpMock.expectOne('/i18n/es.json').flush({});
  });

  it('adjunta el token cuando hay sesión y lo omite si la petición lo pide', () => {
    store.setTokens({ accessToken: 'token-de-prueba', refreshToken: 'r' });
    http.get('/yo').subscribe();
    const req = httpMock.expectOne(`${BASE}/yo`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    req.flush({});
    http.get('/publico', { context: new HttpContext().set(SKIP_AUTH, true) }).subscribe();
    const publico = httpMock.expectOne(`${BASE}/publico`);
    expect(publico.request.headers.has('Authorization')).toBe(false);
    publico.flush({});
  });

  it('avisa cuando no hay red y cuando el servidor falla, salvo en peticiones silenciosas', () => {
    const spy = vi.spyOn(notify, 'error');
    http.get('/algo').subscribe({ error: () => undefined });
    httpMock.expectOne(`${BASE}/algo`).error(new ProgressEvent('error'), { status: 0 });
    expect(spy).toHaveBeenCalledWith('No se pudo conectar con el servidor');
    http.get('/otro').subscribe({ error: () => undefined });
    httpMock.expectOne(`${BASE}/otro`).flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    expect(spy).toHaveBeenCalledWith('Ocurrió un error en el servidor. Inténtalo de nuevo.');
    http.get('/callado', { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({ error: () => undefined });
    httpMock.expectOne(`${BASE}/callado`).flush({ message: 'silencio' }, { status: 400, statusText: 'Bad Request' });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('un 401 con sesión refresca una sola vez y reintenta con el token nuevo', () => {
    store.setTokens({ accessToken: 'viejo', refreshToken: 'refresco' });
    http.get('/protegido').subscribe();
    httpMock.expectOne(`${BASE}/protegido`).flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = httpMock.expectOne(`${BASE}/platform/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresco' });
    refresh.flush({ accessToken: 'nuevo', refreshToken: 'refresco2' });
    const reintento = httpMock.expectOne(`${BASE}/protegido`);
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo');
    reintento.flush({});
    expect(store.accessToken()).toBe('nuevo');
    expect(store.refreshTokenValue()).toBe('refresco2');
  });

  it('si el refresco también cae con 401, limpia la sesión y manda al acceso', () => {
    store.setTokens({ accessToken: 'viejo', refreshToken: 'refresco' });
    const ir = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    http.get('/protegido').subscribe({ error: () => undefined });
    httpMock.expectOne(`${BASE}/protegido`).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${BASE}/platform/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(store.isAuthenticated()).toBe(false);
    expect(ir).toHaveBeenCalledWith(['/acceso']);
  });

  it('un 401 sin sesión no dispara ningún refresco', () => {
    http.get('/protegido').subscribe({ error: () => undefined });
    httpMock.expectOne(`${BASE}/protegido`).flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
