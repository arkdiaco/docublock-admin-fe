import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { SearchDialogComponent } from './search-dialog.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [SearchDialogComponent],
  template: `<dba-search-dialog (closed)="cerrado.set(cerrado() + 1)" />`,
})
class Anfitrion {
  readonly cerrado = signal(0);
}

describe('SearchDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('explica qué se busca, dice con honestidad que aún no busca, y cierra con Escape o el fondo', async () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const campo = host.querySelector<HTMLInputElement>('.box__input')!;
    expect(document.activeElement).toBe(campo);
    expect(host.querySelector('.box__note')?.textContent).toContain('Organizaciones, usuarios o facturas');

    campo.value = 'sierra';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.querySelector('.box__note')?.textContent).toContain('Aún no hay búsqueda disponible');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    host.querySelector<HTMLButtonElement>('.scrim')!.click();
    expect(fixture.componentInstance.cerrado()).toBe(2);
  });
});
