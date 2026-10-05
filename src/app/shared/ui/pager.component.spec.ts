import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { PagerComponent } from './pager.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [PagerComponent],
  template: `<db-pager [page]="page()" [pageCount]="6" (pageChange)="page.set($event)" />`,
})
class Anfitrion {
  readonly page = signal(1);
}

describe('PagerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
  });

  it('pinta todas las páginas, marca la actual y apaga los extremos', () => {
    TestBed.inject(TranslateService).use('es');
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.pager__page')).toHaveLength(6);
    expect(host.querySelector('.pager__page--on')?.textContent?.trim()).toBe('1');

    const pasos = host.querySelectorAll<HTMLButtonElement>('.pager__step');
    expect(pasos[0].disabled).toBe(true);
    expect(pasos[1].disabled).toBe(false);

    pasos[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(2);
    expect(host.querySelector('.pager__page--on')?.textContent?.trim()).toBe('2');
  });
});
