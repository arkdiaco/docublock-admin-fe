import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { conPermisos, configurar } from '../pages/billing-test-kit';
import type { ManualPaymentBody, ManualPlanOption } from '../data/billing.models';
import { ManualPaymentFormComponent } from './manual-payment-form.component';

interface Interno {
  planCode: { set: (v: string) => void };
  interval: { set: (v: string) => void };
  amount: { set: (v: string) => void };
  documents: { set: (v: string) => void };
  reference: { set: (v: string) => void };
  taxes: { set: (v: unknown[]) => void };
  valid: () => boolean;
  amountError: () => string;
  submit: () => void;
}

const PLANES: ManualPlanOption[] = [
  {
    code: 'pro',
    name: 'Profesional',
    kind: 'SUBSCRIPTION',
    currency: 'COP',
    priceMonthly: 100,
    priceAnnual: 0,
    priceOnce: null,
    limits: { documents: 50 },
  },
];

describe('Formulario de pago manual', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:commercial', 'platform:commercial:manage', 'platform:clients']);
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(ManualPaymentFormComponent);
    fixture.componentRef.setInput('organizationId', 'o1');
    const emitidos: ManualPaymentBody[] = [];
    fixture.componentInstance.submitted.subscribe((body) => emitidos.push(body));
    fixture.detectChanges();
    http
      .match((r) => r.url === '/platform/organizations')
      .forEach((p) => p.flush({ total: 0, items: [] }));
    http.expectOne((r) => r.url === '/platform/plans').flush(PLANES);
    await fixture.whenStable();
    fixture.detectChanges();
    http.match(() => true).forEach((p) => p.flush({ total: 0, items: [] }));
    return { fixture, emitidos, form: fixture.componentInstance as unknown as Interno };
  };

  it('avisa lo que va a pasar antes de registrar', async () => {
    const { fixture } = await montar();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Al registrar este pago:');
    expect(texto).toContain('Se abre un periodo nuevo');
    expect(texto).toContain('Se crea la factura');
    expect(texto).toContain('Recibimos tu pago');
  });

  it('con precio de catálogo el monto es opcional; sin él se exige', async () => {
    const { form } = await montar();
    form.planCode.set('pro');
    expect(form.valid()).toBe(true);
    form.interval.set('annual');
    expect(form.amountError()).toBe('billing.manual.amountRequired');
    expect(form.valid()).toBe(false);
    form.amount.set('900');
    expect(form.valid()).toBe(true);
  });

  it('rechaza referencia, documentos e impuestos mal escritos', async () => {
    const { form } = await montar();
    form.planCode.set('pro');
    form.reference.set('con espacio');
    expect(form.valid()).toBe(false);
    form.reference.set('REF-2026');
    form.documents.set('1.5');
    expect(form.valid()).toBe(false);
    form.documents.set('10');
    form.taxes.set([{ type: '', amount: '5' }]);
    expect(form.valid()).toBe(false);
    form.taxes.set([{ type: 'IVA', amount: '5,5' }]);
    expect(form.valid()).toBe(true);
  });

  it('envía solo lo escrito y deja el resto al catálogo', async () => {
    const { form, emitidos } = await montar();
    form.planCode.set('pro');
    form.taxes.set([{ type: 'IVA', amount: '5,5' }]);
    form.submit();
    expect(emitidos[0]).toEqual({
      organizationId: 'o1',
      planCode: 'pro',
      interval: 'monthly',
      amount: undefined,
      currency: undefined,
      documents: undefined,
      paymentMethod: undefined,
      reference: undefined,
      taxes: [{ type: 'IVA', amount: 5.5 }],
    });
  });
});
