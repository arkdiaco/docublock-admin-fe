import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { OrgStateComponent } from './org-state.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('OrgStateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('pinta la familia del estado con su forma de punto y cae en «de baja» si no lo conoce', () => {
    const fixture = TestBed.createComponent(OrgStateComponent);
    fixture.componentRef.setInput('state', 'trial');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.st--trial')?.textContent?.trim()).toBe('Prueba');
    expect(host.querySelector('.st__dot--ring')).not.toBeNull();
    expect(host.querySelector('.st--pill')).not.toBeNull();

    fixture.componentRef.setInput('state', 'inventado');
    fixture.componentRef.setInput('variant', 'inline');
    fixture.detectChanges();
    expect(host.querySelector('.st--closed')).not.toBeNull();
    expect(host.querySelector('.st--inline')).not.toBeNull();
    expect(host.querySelector('.st__dot--dash')).not.toBeNull();
  });
});
