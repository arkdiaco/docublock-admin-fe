import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { EnvPillComponent } from './env-pill.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('EnvPillComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('escribe el entorno completo en mono, nunca abreviado, con la familia de cada uno', () => {
    const fixture = TestBed.createComponent(EnvPillComponent);
    fixture.componentRef.setInput('env', 'production');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.env--production')?.textContent?.trim()).toBe('PRODUCCIÓN');

    fixture.componentRef.setInput('env', 'canary');
    fixture.detectChanges();
    expect(host.querySelector('.env--canary')?.textContent?.trim()).toBe('CANARY');
  });
});
