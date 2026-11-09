import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { API_BASE_URL } from './core/config/api.tokens';

const SUPPORT = [
  'platform:clients',
  'platform:clients:manage',
  'platform:operations',
  'platform:operations:manage',
  'platform:commercial',
  'platform:catalogs',
  'platform:platform',
];
const READONLY = ['platform:clients', 'platform:operations', 'platform:commercial', 'platform:catalogs'];

describe('rutas de la consola', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ fallbackLang: 'es' }),
        MessageService,
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    });
  });

  const entrar = (permisos: string[]) => {
    const store = TestBed.inject(AuthStore);
    store.setTokens({ accessToken: 'token', refreshToken: 'refresh' });
    store.setProfile({
      user: { id: 'u1', names: 'Marta', surNames: 'Vidal', email: 'm@d.co', identification: '1', imageProfile: null },
      platformStaff: true,
      platformPermissions: permisos,
    });
  };

  const ir = async (url: string) => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return router.url;
  };

  it('las rutas de antes llevan a su sección nueva, también con id', async () => {
    entrar(SUPPORT);
    expect(await ir('/organizaciones')).toBe('/clientes/organizaciones');
    expect(await ir('/organizaciones/org-1')).toBe('/clientes/organizaciones/org-1');
    expect(await ir('/facturacion')).toBe('/comercial/facturacion');
    expect(await ir('/auditoria')).toBe('/plataforma/auditoria');
    expect(await ir('/estado')).toBe('/plataforma/salud');
  });

  it('entrar a un grupo abre su primera sección visible: support salta Personal', async () => {
    entrar(SUPPORT);
    expect(await ir('/clientes')).toBe('/clientes/organizaciones');
    expect(await ir('/plataforma')).toBe('/plataforma/auditoria');
  });

  it('Personal exige :manage; Plataforma entera está cerrada a readonly', async () => {
    entrar(SUPPORT);
    expect(await ir('/plataforma/personal')).toBe('/panel');
    entrar(READONLY);
    expect(await ir('/plataforma/auditoria')).toBe('/panel');
    expect(await ir('/comercial/planes')).toBe('/comercial/planes');
  });

  it('Inteligencia abre su primera sección e Ingresos lleva a Facturación', async () => {
    entrar([...READONLY, 'platform:intelligence']);
    expect(await ir('/inteligencia')).toBe('/inteligencia/analitica');
    expect(await ir('/inteligencia/ingresos')).toBe('/comercial/facturacion/ingresos');
    entrar(READONLY);
    expect(await ir('/inteligencia/analitica')).toBe('/panel');
  });

  it('sin sesión todo manda al acceso con la vuelta guardada', async () => {
    expect(await ir('/clientes/organizaciones')).toBe('/acceso?redirect=%2Fclientes%2Forganizaciones');
    expect(await ir('/sistema/diseno')).toBe('/acceso?redirect=%2Fsistema%2Fdiseno');
  });
});
