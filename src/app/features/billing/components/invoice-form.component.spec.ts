import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { conPermisos, configurar, factura } from '../pages/billing-test-kit';
import type { InvoiceBody } from '../data/billing.models';
import { InvoiceFormComponent } from './invoice-form.component';

interface Interno {
  clientName: { set: (v: string) => void };
  clientEmail: { set: (v: string) => void };
  dueDate: { set: (v: string) => void };
  issueDate: { set: (v: string) => void };
  items: { set: (v: unknown[]) => void };
  valid: () => boolean;
  totals: () => { subtotal: number; taxes: number; total: number };
  submit: () => void;
}

describe('Formulario de factura', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = () => {
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const emitidos: InvoiceBody[] = [];
    fixture.componentInstance.submitted.subscribe((body) => emitidos.push(body));
    return { fixture, emitidos, form: fixture.componentInstance as unknown as Interno };
  };

  it('exige cliente, ítem válido y fechas en orden', () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { fixture, form, emitidos } = montar();
    fixture.detectChanges();
    expect(form.valid()).toBe(false);
    form.clientName.set('Cliente');
    form.clientEmail.set('c@x.co');
    form.items.set([{ concept: 'Plan', quantity: '2', unitPrice: '100,5' }]);
    expect(form.valid()).toBe(true);
    expect(form.totals()).toEqual({ subtotal: 201, taxes: 0, total: 201 });
    form.issueDate.set('2026-10-10');
    form.dueDate.set('2026-10-01');
    expect(form.valid()).toBe(false);
    form.dueDate.set('2026-10-20');
    form.submit();
    expect(emitidos[0].items).toEqual([{ concept: 'Plan', quantity: 2, unitPrice: 100.5 }]);
    expect(emitidos[0].clientName).toBe('Cliente');
  });

  it('al editar carga la factura y no cambia la organización', () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage', 'platform:clients']);
    const { fixture, form, emitidos } = montar();
    fixture.componentRef.setInput('invoice', factura());
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('dba-org-picker')).toBeNull();
    expect(host.textContent).toContain('La organización no se cambia al editar.');
    expect(form.totals().total).toBe(297500);
    form.submit();
    expect(emitidos[0].organizationId).toBeUndefined();
    expect(emitidos[0].taxes).toEqual([{ type: 'IVA 19%', amount: 47500 }]);
  });
});
