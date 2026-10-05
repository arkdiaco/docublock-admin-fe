import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { RecordHeaderComponent } from './record-header.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

@Component({
  imports: [RecordHeaderComponent],
  template: `
    <dba-record-header
      [crumbs]="['nav.crumbRoot', 'nav.organizations', 'ORG-0412']"
      initials="SN"
      title="Aeropuerto Sierra Norte"
      state="active"
      meta="ORG-0412 · sierranorte.aero"
    >
      <button actions class="editar">Editar</button>
    </dba-record-header>
  `,
})
class Anfitrion {}

describe('RecordHeaderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('traduce las migas, deja el identificador literal, pinta avatar, nombre, estado, meta y la acción proyectada', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const crumbs = [...host.querySelectorAll('.rec__crumb')].map((c) => c.textContent?.trim());
    expect(crumbs).toEqual(['Admin', 'Organizaciones', 'ORG-0412']);
    expect(host.querySelector('.rec__crumb--last')?.textContent?.trim()).toBe('ORG-0412');
    expect(host.querySelector('.rec__avatar')?.textContent?.trim()).toBe('SN');
    expect(host.querySelector('.rec__name')?.textContent?.trim()).toBe('Aeropuerto Sierra Norte');
    expect(host.querySelector('.st--active')?.textContent).toContain('Activa');
    expect(host.querySelector('.rec__meta')?.textContent).toContain('sierranorte.aero');
    expect(host.querySelector('.editar')).not.toBeNull();
    expect(host.textContent).not.toMatch(/\b(nav|shell|org)\.[a-zA-Z]/);
  });
});
