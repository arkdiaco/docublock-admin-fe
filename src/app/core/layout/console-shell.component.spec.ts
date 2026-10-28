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

const TODOS = ['platform:clients', 'platform:commercial', 'platform:platform'];

describe('ConsoleShellComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'panel', component: Pagina, data: { titleKey: 'nav.overview' } },
          {
            path: 'clientes',
            data: { titleKey: 'nav.group.clients' },
            children: [{ path: 'organizaciones', component: Pagina, data: { titleKey: 'nav.organizations' } }],
          },
          { path: 'sistema/diseno', component: Pagina, data: { titleKey: 'sys.title' } },
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

  const montar = async (url = '/panel') => {
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

  const textos = (host: Element, selector: string) => [...host.querySelectorAll(selector)].map((el) => el.firstElementChild?.textContent?.trim() ?? el.textContent?.trim());

  it('sin sesión solo muestra Visión general y ofrece entrar', async () => {
    const { host } = await montar();
    expect(textos(host, '.bar__link')).toEqual(['Visión general']);
    expect(host.querySelectorAll('dba-nav-group').length).toBe(0);
    expect(host.querySelector('.bar__enter')?.getAttribute('href')).toBe('/acceso');
    expect(host.querySelector('.bar__avatar')).toBeNull();
    expect(host.querySelector('dba-env-pill')).not.toBeNull();
  });

  it('con sesión muestra los grupos que puede abrir y marca el de la sección activa', async () => {
    entrar(TODOS);
    const { host } = await montar('/clientes/organizaciones');
    expect(textos(host, '.bar .trigger')).toEqual(['Clientes', 'Comercial', 'Plataforma']);
    const [clientes, comercial] = [...host.querySelectorAll('.bar .trigger')];
    expect(clientes.classList.contains('trigger--on')).toBe(true);
    expect(comercial.classList.contains('trigger--on')).toBe(false);
    expect(host.querySelector('.bar__link')?.classList.contains('bar__link--on')).toBe(false);
    expect(host.querySelector('.bar__avatar')?.textContent?.trim()).toBe('MV');
  });

  it('un permiso parcial deja solo su grupo', async () => {
    entrar(['platform:commercial']);
    const { host } = await montar();
    expect(textos(host, '.bar .trigger')).toEqual(['Comercial']);
  });

  it('el grupo suma los conteos de sus secciones y los quita cuando no hay cola', async () => {
    entrar(TODOS);
    const { fixture, host } = await montar();
    expect(host.querySelectorAll('.bar .count').length).toBe(0);
    TestBed.inject(NavCounts).set('organizations', 312);
    fixture.detectChanges();
    expect([...host.querySelectorAll('.bar .trigger .count')].map((c) => c.textContent?.trim())).toEqual(['312']);
    TestBed.inject(NavCounts).set('organizations', 0);
    fixture.detectChanges();
    expect(host.querySelectorAll('.bar .count').length).toBe(0);
  });

  it('las migas llevan el grupo antes de la sección', async () => {
    entrar(TODOS);
    const { host, router, fixture } = await montar('/clientes/organizaciones');
    expect([...host.querySelectorAll('.crumbs__item')].map((c) => c.textContent?.trim())).toEqual(['Admin', 'Clientes', 'Organizaciones']);
    await router.navigateByUrl('/sistema/diseno');
    fixture.detectChanges();
    expect([...host.querySelectorAll('.crumbs__item')].map((c) => c.textContent?.trim())).toEqual(['Admin', 'Sistema de diseño']);
    expect(host.querySelector('.crumbs__item--last')?.textContent?.trim()).toBe('Sistema de diseño');
  });

  it('la hamburguesa abre el cajón por grupos, sin Personal para quien no tiene :manage, y se cierra al elegir o con Escape', async () => {
    entrar(TODOS);
    const { fixture, host } = await montar('/panel');
    expect(host.querySelector('.drawer')).toBeNull();
    host.querySelector<HTMLButtonElement>('.bar__burger')!.click();
    fixture.detectChanges();
    expect(textos(host, '.drawer .heading')).toEqual(['Clientes', 'Comercial', 'Plataforma']);
    const enlaces = [...host.querySelectorAll<HTMLAnchorElement>('.drawer .link--drawer')];
    expect(enlaces.length).toBe(4 + 7 + 3);
    expect(enlaces.map((a) => a.getAttribute('href'))).not.toContain('/plataforma/personal');
    expect(enlaces[0].getAttribute('href')).toBe('/clientes/organizaciones');
    expect(host.querySelector('.drawer__link')?.getAttribute('href')).toBe('/panel');

    enlaces[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
