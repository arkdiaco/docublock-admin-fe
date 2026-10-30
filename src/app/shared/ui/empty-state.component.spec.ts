import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { EmptyStateComponent } from './empty-state.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('EmptyStateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('traduce título y pista, y sin pista no deja párrafo vacío', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('titleKey', 'overview.actionsEmpty');
    fixture.componentRef.setInput('leadKey', 'overview.actionsLead');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.empty__title')?.textContent).toContain('Nada pendiente');
    expect(host.querySelector('.empty__lead')?.textContent).toContain('cupo agotado');

    fixture.componentRef.setInput('leadKey', '');
    fixture.detectChanges();
    expect(host.querySelector('.empty__lead')).toBeNull();
  });
});
