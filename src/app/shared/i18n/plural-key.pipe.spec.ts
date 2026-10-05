import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import { PluralKeyPipe } from './plural-key.pipe';

class Catalogo implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({ x: { docs: '{{n}} documentos', docsOne: '1 documento', only: '{{n}} cosas' } });
  }
}

describe('PluralKeyPipe', () => {
  it('usa la variante One solo cuando el conteo es 1 y la llave existe', () => {
    TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: Catalogo }, fallbackLang: 'es' })],
    });
    TestBed.inject(TranslateService).use('es');
    const pipe = TestBed.runInInjectionContext(() => new PluralKeyPipe());
    expect(pipe.transform('x.docs', 1)).toBe('x.docsOne');
    expect(pipe.transform('x.docs', 2)).toBe('x.docs');
    expect(pipe.transform('x.docs', 0)).toBe('x.docs');
    expect(pipe.transform('x.only', 1)).toBe('x.only');
  });
});
