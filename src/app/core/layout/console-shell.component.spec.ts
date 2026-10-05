import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { AuthStore } from '../auth/auth.store';
import { API_BASE_URL } from '../config/api.tokens';
import { ConsoleShellComponent } from './console-shell.component';
import { NavCounts } from './nav-counts.service';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({ template: '<p class="pagina">hola</p>' })
class Pagina {}

const TODOS = ['platform:organizations', 'platform:users', 'platform:plans', 'platform:billing', 'platform:security', 'platform:audit'];

describe('ConsoleShellComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'panel', component: Pagina, data: { titleKey: 'nav.overview' } },
          { path: 'organizaciones', component: Pagina, data: { titleKey: 'nav.organizations' } },
          {
            path: 'sistema',
            data: { titleKey: 'nav.system' },
            children: [
              { path: '', component: Pagina },
              { path: 'diseno', component: Pagina, data: { titleKey: 'sys.title' } },
            ],
          },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' }),
        { provide: API_BASE_URL, useValue: 'http://api.test/api/core' },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = async (url = '/sistema') => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(ConsoleShellComponent);
    fixture.detectChanges();
    await router.navigateByUrl(url);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement, router };
  };

  const entrar = (permisos: string[]) => {
    const store = TestBed.inject(AuthStore);
    store.setTokens({ accessToken: 'token', refreshToken: 'refresh' });
    store.setProfile({
      user: { id: 'u1', names: 'Marta', surNames: 'Vidal', email: 'marta@docublock.co', identification: '1', imageProfile: null },
      platformStaff: true,
      platformPermissions: permisos,
    });
  };

  it('sin sesión solo muestra las áreas libres y ofrece entrar', async () => {
    const { host } = await montar();
    const etiquetas = [...host.querySelectorAll('.bar__link')].map((a) => a.textContent?.trim());
    expect(etiquetas).toEqual(['Visión general', 'Sistema']);
    expect(host.querySelector('.bar__enter')?.getAttribute('href')).toBe('/acceso');
    expect(host.querySelector('.bar__avatar')).toBeNull();
    expect(host.querySelector('dba-env-pill')).not.toBeNull();
  });

  it('con sesión y permisos muestra las ocho entradas, marca la activa y pone las iniciales', async () => {
    entrar(TODOS);
    const { host } = await montar('/organizaciones');
    const enlaces = [...host.querySelectorAll<HTMLAnchorElement>('.bar__link')];
    expect(enlaces.length).toBe(8);
    expect(enlaces[1].classList.contains('bar__link--on')).toBe(true);
    expect(enlaces[1].getAttribute('aria-current')).toBe('page');
    expect(enlaces[0].classList.contains('bar__link--on')).toBe(false);
    expect(host.querySelector('.bar__avatar')?.textContent?.trim()).toBe('MV');
    expect(host.querySelector('.bar__enter')).toBeNull();
  });

  it('un permiso parcial recorta el menú a lo que se puede abrir', async () => {
    entrar(['platform:billing']);
    const { host } = await montar();
    const etiquetas = [...host.querySelectorAll('.bar__link')].map((a) => a.textContent?.trim());
    expect(etiquetas).toEqual(['Visión general', 'Facturación', 'Sistema']);
  });

  it('los conteos solo salen donde hay cola', async () => {
    entrar(TODOS);
    const { fixture, host } = await montar();
    expect(host.querySelectorAll('.bar__count').length).toBe(0);
    TestBed.inject(NavCounts).set('organizations', 312);
    fixture.detectChanges();
    const chips = [...host.querySelectorAll('.bar__count')].map((c) => c.textContent?.trim());
    expect(chips).toEqual(['312']);
    TestBed.inject(NavCounts).set('organizations', 0);
    fixture.detectChanges();
    expect(host.querySelectorAll('.bar__count').length).toBe(0);
  });

  it('las migas siguen la ruta activa, con Admin delante y la hoja en tinta', async () => {
    const { host, router, fixture } = await montar('/sistema/diseno');
    const migas = [...host.querySelectorAll('.crumbs__item')].map((c) => c.textContent?.trim());
    expect(migas).toEqual(['Admin', 'Sistema', 'Sistema de diseño']);
    expect(host.querySelector('.crumbs__item--last')?.textContent?.trim()).toBe('Sistema de diseño');
    await router.navigateByUrl('/sistema');
    fixture.detectChanges();
    expect([...host.querySelectorAll('.crumbs__item')].map((c) => c.textContent?.trim())).toEqual(['Admin', 'Sistema']);
  });

  it('la hamburguesa abre el cajón con las entradas permitidas y se cierra al elegir una o con Escape', async () => {
    entrar(TODOS);
    const { fixture, host } = await montar('/panel');
    expect(host.querySelector('.drawer')).toBeNull();
    host.querySelector<HTMLButtonElement>('.bar__burger')!.click();
    fixture.detectChanges();
    const enlaces = [...host.querySelectorAll('.drawer__link')];
    expect(enlaces.length).toBe(8);
    expect(enlaces[0].textContent).toContain('Visión general');
    expect(enlaces[0].getAttribute('href')).toBe('/panel');

    host.querySelector<HTMLButtonElement>('.bar__burger')!.click();
    fixture.detectChanges();
    enlaces[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('.drawer')).toBeNull();

    host.querySelector<HTMLButtonElement>('.bar__burger')!.click();
    fixture.detectChanges();
    expect(host.querySelector('.drawer')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(host.querySelector('.drawer')).toBeNull();
  });

  it('⌘K y la caja abren el buscador; Escape lo cierra', async () => {
    const { fixture, host } = await montar();
    expect(host.querySelector('dba-search-dialog')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    fixture.detectChanges();
    expect(host.querySelector('dba-search-dialog')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(host.querySelector('dba-search-dialog')).toBeNull();
    host.querySelector<HTMLButtonElement>('.bar__search')!.click();
    fixture.detectChanges();
    expect(host.querySelector('dba-search-dialog')).not.toBeNull();
    expect(host.textContent).not.toMatch(/\b(nav|shell|env|sys)\.[a-zA-Z]/);
  });
});
