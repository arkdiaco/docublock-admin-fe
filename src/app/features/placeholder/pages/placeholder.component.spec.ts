import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { PlaceholderComponent } from './placeholder.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('PlaceholderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('titula con la llave de la ruta y dice que el módulo aún no está', () => {
    const fixture = TestBed.createComponent(PlaceholderComponent);
    fixture.componentRef.setInput('titleKey', 'nav.billing');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Facturación');
    expect(host.querySelector('.empty__title')?.textContent).toContain('Nada que mostrar');
    expect(host.textContent).not.toMatch(/\b(nav|placeholder)\.[a-zA-Z]/);
  });
});
