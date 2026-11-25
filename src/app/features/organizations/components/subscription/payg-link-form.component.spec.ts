import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../../public/i18n/es.json';
import type { CatalogPlan } from '../../data/subscription.models';
import { PaygLinkFormComponent } from './payg-link-form.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

const PAYG: CatalogPlan = {
  code: 'PAYG_CO',
  name: 'Pago por documento',
  family: 'PAYG',
  kind: 'PACKAGE',
  currency: 'COP',
  validityMonths: 12,
  limits: { documents: 10, idBiometric: 0, idAni: 0, idIdentity: 0 },
};

const CORP: CatalogPlan = {
  code: 'CORP',
  name: 'Corporativo',
  family: 'CORE',
  kind: 'SUBSCRIPTION',
  currency: 'COP',
  validityMonths: null,
  limits: { documents: 200, idBiometric: null, idAni: null, idIdentity: null },
};

const montar = async (plans: CatalogPlan[] = [PAYG, CORP]) => {
  await TestBed.configureTestingModule({
    imports: [PaygLinkFormComponent],
    providers: [
      { provide: LOCALE_ID, useValue: 'en-US' },
      provideTranslateService({
        loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
        fallbackLang: 'es',
      }),
    ],
  }).compileComponents();
  TestBed.inject(TranslateService).use('es');
  const fixture = TestBed.createComponent(PaygLinkFormComponent);
  fixture.componentRef.setInput('plans', plans);
  fixture.componentRef.setInput('orgName', 'Sierra Norte');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
};

const escribir = (host: HTMLElement, indice: number, valor: string) => {
  const input = host.querySelectorAll<HTMLInputElement>('dba-field input')[indice];
  input.value = valor;
  input.dispatchEvent(new Event('input'));
};

const confirmar = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === 'Generar enlace',
  )!;

describe('PaygLinkFormComponent', () => {
  it('con un solo plan de pago por documento lo elige solo, calcula el total en vivo y emite la cotización', async () => {
    const { fixture, host } = await montar();
    expect(confirmar(host).disabled).toBe(true);
    escribir(host, 0, '150');
    escribir(host, 1, '2500');
    fixture.detectChanges();
    expect(host.querySelector('.pg__total strong')?.textContent).toContain('375,000');
    expect(host.textContent).toContain('Los documentos valen 12 meses desde el pago.');
    expect(host.textContent).toContain('reemplaza el plan actual');
    const emitido = vi.fn();
    fixture.componentInstance.submitted.subscribe(emitido);
    expect(confirmar(host).disabled).toBe(false);
    confirmar(host).click();
    expect(emitido).toHaveBeenCalledWith({ planCode: 'PAYG_CO', documents: 150, unitPrice: 2500 });
  });

  it('acepta el valor con coma decimal y rechaza cantidades o valores inválidos', async () => {
    const { fixture, host } = await montar();
    escribir(host, 0, '3');
    escribir(host, 1, '1,15');
    fixture.detectChanges();
    expect(host.querySelector('.pg__total strong')?.textContent).toContain('3.45');
    escribir(host, 0, '0');
    escribir(host, 1, '1.234');
    fixture.detectChanges();
    expect(host.textContent).toContain('Escribe un número entero mayor que cero');
    expect(host.textContent).toContain('Escribe un valor mayor que cero, con máximo dos decimales');
    expect(host.querySelector('.pg__total strong')?.textContent?.trim()).toBe('—');
    expect(confirmar(host).disabled).toBe(true);
  });

  it('con el enlace generado muestra la URL, el total y la referencia', async () => {
    const { fixture, host } = await montar();
    fixture.componentRef.setInput('result', {
      url: 'https://pay.test/lnk-1',
      paymentLinkId: 'lnk-1',
      reference: 'DOC-1-ab',
      transactionId: 'tx-1',
      planCode: 'PAYG_CO',
      planName: 'Pago por documento',
      documents: 150,
      unitPrice: 2500,
      amount: 375000,
      currency: 'COP',
      validityMonths: 12,
    });
    fixture.detectChanges();
    expect(host.querySelector('.pg__link')?.textContent?.trim()).toBe('https://pay.test/lnk-1');
    expect(host.textContent).toContain('150 documentos');
    expect(host.textContent).toContain('375,000');
    expect(host.textContent).toContain('Referencia DOC-1-ab');
  });
});
