import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../public/i18n/es.json';
import { AuthStore } from '../../../core/auth/auth.store';
import { OverviewComponent, greetingKeyOf } from './overview.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('OverviewComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('el saludo depende de la hora', () => {
    expect(greetingKeyOf(8)).toBe('overview.greeting.morning');
    expect(greetingKeyOf(15)).toBe('overview.greeting.afternoon');
    expect(greetingKeyOf(21)).toBe('overview.greeting.evening');
  });

  it('saluda por el primer nombre, pinta las cuatro cifras sin datos y los dos paneles vacíos con honestidad', () => {
    TestBed.inject(AuthStore).setProfile({
      user: { id: 'u1', names: 'Marta Lucía', surNames: 'Vidal', email: 'm@d.co', identification: '1', imageProfile: null },
      platformStaff: true,
      platformPermissions: [],
    });
    const fixture = TestBed.createComponent(OverviewComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h1')?.textContent).toMatch(/Buen[oa]s (días|tardes|noches), Marta$/);
    expect(host.querySelectorAll('dba-kpi-card').length).toBe(4);
    expect([...host.querySelectorAll('.kpi__value')].every((v) => v.textContent?.trim() === '—')).toBe(true);
    expect(host.querySelectorAll('dba-empty-state').length).toBe(2);
    expect(host.querySelector('.panel__link')?.getAttribute('href')).toBe('/auditoria');
    expect(host.querySelector('.ov__date')?.textContent?.trim().length).toBeGreaterThan(8);
    expect(host.textContent).not.toMatch(/\b(overview|nav)\.[a-zA-Z]/);
  });
});
