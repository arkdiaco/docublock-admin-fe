import { TestBed } from '@angular/core/testing';
import {
  provideTranslateService,
  TranslateLoader,
  TranslateService,
  type TranslationObject,
} from '@ngx-translate/core';
import { of, type Observable } from 'rxjs';
import es from '../../../../../../public/i18n/es.json';
import type { AssignPlanBody, CounterBody } from '../../data/subscription.models';
import { AssignPlanFormComponent } from './assign-plan-form.component';
import { CounterFormComponent } from './counter-form.component';

class CatalogoEspanol implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of(es as unknown as TranslationObject);
  }
}

type Interna = Record<string, { set: (v: unknown) => void } & (() => unknown)> & {
  submit: () => void;
};

describe('Formularios de suscripción', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignPlanFormComponent, CounterFormComponent],
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: CatalogoEspanol },
          fallbackLang: 'es',
        }),
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('es');
  });

  it('asignar: arrastra por defecto, sin vencimiento manda noExpiry y documentos vacíos no se mandan', () => {
    const fixture = TestBed.createComponent(AssignPlanFormComponent);
    fixture.componentRef.setInput('plans', [
      {
        code: 'CORP',
        name: 'Corporativo',
        family: 'f',
        kind: 'SUBSCRIPTION',
        validityMonths: 12,
        limits: { documents: 200, idBiometric: null, idAni: null, idIdentity: null },
      },
    ]);
    fixture.componentRef.setInput('orgName', 'Sierra');
    fixture.componentRef.setInput('labels', {
      planValidity: () => 'del plan',
      until: 'hasta',
      none: 'sin',
    });
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Interna;
    const enviados: AssignPlanBody[] = [];
    fixture.componentInstance.submitted.subscribe((body) => enviados.push(body));
    form['planCode'].set('CORP');
    form['reason'].set('Alta');
    form['validity'].set('none');
    form.submit();
    expect(enviados[0]).toEqual({ planCode: 'CORP', carry: true, reason: 'Alta', noExpiry: true });
    form['validity'].set('date');
    form['until'].set('2020-01-01');
    form.submit();
    expect(enviados).toHaveLength(1);
    form['until'].set('2099-06-30');
    form['carry'].set(false);
    form['documents'].set('80');
    form.submit();
    expect(enviados[1]).toMatchObject({ carry: false, documents: 80 });
    expect(enviados[1].periodEnd).toMatch(/^2099-0[67]-/);
  });

  it('contador: ilimitado manda limit null; sin cambios no deja guardar', () => {
    const fixture = TestBed.createComponent(CounterFormComponent);
    fixture.componentRef.setInput('counter', {
      resource: 'DOCUMENTS',
      limit: 200,
      used: 150,
      remaining: 50,
    });
    fixture.componentRef.setInput('unlimitedLabel', 'ilimitado');
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Interna;
    const enviados: CounterBody[] = [];
    fixture.componentInstance.submitted.subscribe((body) => enviados.push(body));
    form['reason'].set('Ajuste');
    form.submit();
    expect(enviados).toEqual([]);
    form['unlimited'].set(true);
    form.submit();
    expect(enviados[0]).toEqual({ limit: null, reason: 'Ajuste' });
    form['unlimited'].set(false);
    form['limit'].set('300');
    form['used'].set('10');
    form.submit();
    expect(enviados[1]).toEqual({ limit: 300, used: 10, reason: 'Ajuste' });
  });
});
