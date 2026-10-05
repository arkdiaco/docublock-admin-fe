import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { QuotaBarComponent } from './quota-bar.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('QuotaBarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = (used: number, limit: number | null, valueText: string) => {
    const fixture = TestBed.createComponent(QuotaBarComponent);
    fixture.componentRef.setInput('label', 'sys.c.quotaStorage');
    fixture.componentRef.setInput('used', used);
    fixture.componentRef.setInput('limit', limit);
    fixture.componentRef.setInput('valueText', valueText);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('morada mientras cuenta, ámbar al 90 % y roja al 100 %, con el ancho de la barra acotado', () => {
    const ok = montar(48, 60, '48 / 60');
    expect(ok.querySelector('.quota__fill--ok')).not.toBeNull();
    expect((ok.querySelector('.quota__fill') as HTMLElement).style.width).toBe('80%');
    expect(ok.querySelector('.quota__label')?.textContent?.trim()).toBe('Almacenamiento');

    const warn = montar(184.2, 200, '184,2 / 200 GB');
    expect(warn.querySelector('.quota__fill--warn')).not.toBeNull();
    expect(warn.querySelector('.quota__value--warn')).not.toBeNull();

    const over = montar(403, 400, '403 / 400 GB');
    expect(over.querySelector('.quota__fill--over')).not.toBeNull();
    expect((over.querySelector('.quota__fill') as HTMLElement).style.width).toBe('100%');
    expect(over.querySelector('[role="meter"]')?.getAttribute('aria-valuemax')).toBe('400');
  });

  it('sin límite la barra queda vacía y nunca avisa', () => {
    const host = montar(1000, null, '1 000');
    expect((host.querySelector('.quota__fill') as HTMLElement).style.width).toBe('0%');
    expect(host.querySelector('.quota__fill--ok')).not.toBeNull();
  });
});
