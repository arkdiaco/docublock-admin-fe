import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { NavGroupComponent, type NavGroupLink } from './nav-group.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [NavGroupComponent],
  template: `<dba-nav-group [variant]="variant()" labelKey="nav.group.clients" [links]="links()" [active]="active()" (navigated)="picks = picks + 1" />`,
})
class Anfitrion {
  readonly variant = signal<'bar' | 'drawer'>('bar');
  readonly active = signal(false);
  readonly links = signal<NavGroupLink[]>([
    { key: 'organizations', labelKey: 'nav.organizations', path: '/clientes/organizaciones', count: 3 },
    { key: 'users', labelKey: 'nav.users', path: '/clientes/usuarios', count: 2 },
  ]);
  picks = 0;
}

describe('NavGroupComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  };

  it('en la barra es un disparador con el total de sus secciones, cerrado de entrada', () => {
    const { fixture, host } = montar();
    const trigger = host.querySelector<HTMLButtonElement>('.trigger')!;
    expect(trigger.textContent).toContain('Clientes');
    expect(trigger.querySelector('.count')?.textContent?.trim()).toBe('5');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.classList.contains('trigger--on')).toBe(false);
    fixture.componentInstance.active.set(true);
    fixture.detectChanges();
    expect(trigger.classList.contains('trigger--on')).toBe(true);
  });

  it('sin conteos no pinta el total', () => {
    const { fixture, host } = montar();
    fixture.componentInstance.links.set([{ key: 'users', labelKey: 'nav.users', path: '/clientes/usuarios' }]);
    fixture.detectChanges();
    expect(host.querySelector('.trigger .count')).toBeNull();
  });

  it('en el cajón lista sus secciones bajo el encabezado y avisa al elegir', async () => {
    const { fixture, host } = montar();
    fixture.componentInstance.variant.set('drawer');
    fixture.detectChanges();
    expect(host.querySelector('.heading')?.textContent?.trim()).toBe('Clientes');
    const enlaces = [...host.querySelectorAll<HTMLAnchorElement>('.link--drawer')];
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/clientes/organizaciones', '/clientes/usuarios']);
    expect(enlaces[0].textContent).toContain('Organizaciones');
    enlaces[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.picks).toBe(1);
    expect(host.textContent).not.toMatch(/\bnav\.[a-zA-Z]/);
  });
});
