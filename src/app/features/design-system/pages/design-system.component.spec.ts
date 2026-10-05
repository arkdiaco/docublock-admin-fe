import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { DesignSystemComponent } from './design-system.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('DesignSystemComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = () => {
    const fixture = TestBed.createComponent(DesignSystemComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('muestra la rampa completa con el 500 marcado como primario', () => {
    const host = montar();
    const pasos = host.querySelectorAll('.ramp__step');
    expect(pasos.length).toBe(11);
    expect(host.querySelector('.ramp__n--primary')?.textContent?.trim()).toBe('500');
    expect(host.querySelectorAll('.ramp__hex')[5].textContent?.trim()).toBe('#7954FD');
  });

  it('pinta los cinco estados con su forma de punto y los cuatro roles', () => {
    const host = montar();
    const formas = Array.from(host.querySelectorAll('.pill__dot')).map((dot) => dot.className.replace(/.*pill__dot--(\w+).*/, '$1'));
    expect(formas).toEqual(['circle', 'ring', 'square', 'square', 'dash']);
    expect(host.querySelectorAll('.pill').length).toBe(5);
    expect(host.querySelectorAll('.role').length).toBe(4);
    expect(host.querySelector('.pill--active')?.textContent).toContain('Activa');
    expect(host.querySelector('.role--superadmin')?.textContent).toMatch(/superadmin/i);
  });

  it('las muestras tipográficas usan las clases de la casa y nada sale como llave cruda', () => {
    const host = montar();
    expect(host.querySelectorAll('.type__row').length).toBe(7);
    expect(host.querySelector('.type__row .dba-kpi')?.textContent?.trim()).toBe('312');
    expect(host.querySelector('.type__row .dba-id')).not.toBeNull();
    expect(host.textContent).not.toMatch(/\b(sys|org|role|shell|env)\.[a-zA-Z]/);
  });
});
