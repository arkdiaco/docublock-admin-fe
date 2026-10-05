import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { ConsoleTitleStrategy, titleKeysOf } from './console-title.strategy';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({ template: '' })
class Pagina {}

describe('ConsoleTitleStrategy', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'panel', component: Pagina, data: { titleKey: 'nav.overview' } },
          {
            path: 'sistema',
            data: { titleKey: 'nav.system' },
            children: [
              { path: '', component: Pagina },
              { path: 'diseno', component: Pagina, data: { titleKey: 'sys.title' } },
            ],
          },
          { path: 'libre', component: Pagina },
        ]),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' }),
        { provide: TitleStrategy, useClass: ConsoleTitleStrategy },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('el título del documento es la hoja traducida más la marca; sin llave queda la marca', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/panel');
    expect(document.title).toBe('Visión general · Docublock Admin');
    await router.navigateByUrl('/sistema/diseno');
    expect(document.title).toBe('Sistema de diseño · Docublock Admin');
    expect(titleKeysOf(router.routerState.snapshot.root)).toEqual(['nav.system', 'sys.title']);
    await router.navigateByUrl('/libre');
    expect(document.title).toBe('Docublock Admin');
  });
});
