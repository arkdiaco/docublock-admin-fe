import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { RoleTagComponent } from './role-tag.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('RoleTagComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('rotula el rol en mono con su familia y un rol desconocido baja a lectura', () => {
    const fixture = TestBed.createComponent(RoleTagComponent);
    fixture.componentRef.setInput('role', 'support');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.role--support')?.textContent?.trim()).toBe('SOPORTE');

    fixture.componentRef.setInput('role', 'otro');
    fixture.detectChanges();
    expect(host.querySelector('.role--readonly')?.textContent?.trim()).toBe('LECTURA');
  });
});
