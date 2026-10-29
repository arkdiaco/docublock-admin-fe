import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { OrgFlagComponent } from './org-flag.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('OrgFlagComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgFlagComponent],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('marca la organización de prueba con el tono de aviso y la reseller en neutro', () => {
    const fixture = TestBed.createComponent(OrgFlagComponent);
    fixture.componentRef.setInput('kind', 'test');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.flag--test')?.textContent?.trim()).toBe('PRUEBA');
    fixture.componentRef.setInput('kind', 'reseller');
    fixture.detectChanges();
    expect(host.querySelector('.flag--reseller')?.textContent?.trim()).toBe('RESELLER');
  });
});
