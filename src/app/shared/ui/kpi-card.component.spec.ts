import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../public/i18n/es.json';
import { KpiCardComponent } from './kpi-card.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

describe('KpiCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogoEspanol }, fallbackLang: 'es' })],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('rótulo traducido, cifra tal cual y delta con su tono; sin delta no pinta la línea', () => {
    const fixture = TestBed.createComponent(KpiCardComponent);
    fixture.componentRef.setInput('label', 'sys.c.kpiWarn');
    fixture.componentRef.setInput('value', '9');
    fixture.componentRef.setInput('delta', '3 por almacenamiento');
    fixture.componentRef.setInput('deltaTone', 'warn');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.kpi__label')?.textContent?.trim()).toBe('Con aviso');
    expect(host.querySelector('.kpi__value')?.textContent?.trim()).toBe('9');
    expect(host.querySelector('.kpi__delta--warn')?.textContent).toContain('almacenamiento');
    expect(host.querySelector('.kpi--dense')).toBeNull();

    fixture.componentRef.setInput('delta', '');
    fixture.componentRef.setInput('dense', true);
    fixture.detectChanges();
    expect(host.querySelector('.kpi__delta')).toBeNull();
    expect(host.querySelector('.kpi--dense')).not.toBeNull();
  });
});
