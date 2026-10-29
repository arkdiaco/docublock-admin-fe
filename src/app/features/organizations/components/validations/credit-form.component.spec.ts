import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../../public/i18n/es.json';
import type { CreditBalance } from '../../data/validations.models';
import { CreditFormComponent } from './credit-form.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

interface Form {
  unlimited: { set: (v: boolean) => void };
  mode: { set: (v: string) => void };
  amount: { set: (v: string) => void };
  reason: { set: (v: string) => void };
  change: () => unknown;
  valid: () => boolean;
}

describe('CreditFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditFormComponent],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  const montar = (balance: CreditBalance) => {
    const fixture = TestBed.createComponent(CreditFormComponent);
    fixture.componentRef.setInput('type', 'ani');
    fixture.componentRef.setInput('balance', balance);
    fixture.componentRef.setInput('modeLabels', { recharge: 'Recargar', set: 'Fijar' });
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Form;
  };

  it('recargar exige al menos 1 y motivo', () => {
    const form = montar({ unlimited: false, remaining: 5 });
    form.amount.set('0');
    form.reason.set('Compra');
    expect(form.valid()).toBe(false);
    form.amount.set('12');
    expect(form.change()).toEqual({ recharge: 12 });
    expect(form.valid()).toBe(true);
  });

  it('fijar el saldo admite cero', () => {
    const form = montar({ unlimited: false, remaining: 5 });
    form.mode.set('set');
    form.amount.set('0');
    form.reason.set('Corrección');
    expect(form.change()).toEqual({ remaining: 0 });
  });

  it('pasar a ilimitado y volver a limitado', () => {
    const limited = montar({ unlimited: false, remaining: 5 });
    limited.unlimited.set(true);
    expect(limited.change()).toEqual({ unlimited: true });
    const unlimited = montar({ unlimited: true, remaining: 0 });
    expect(unlimited.change()).toBeNull();
    unlimited.unlimited.set(false);
    expect(unlimited.change()).toEqual({ unlimited: false });
    unlimited.amount.set('30');
    expect(unlimited.change()).toEqual({ unlimited: false, recharge: 30 });
  });
});
