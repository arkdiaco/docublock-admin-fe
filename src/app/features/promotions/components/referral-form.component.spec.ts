import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { codigo, configurar, referido } from '../pages/promotions-test-kit';
import { ReferralFormComponent } from './referral-form.component';

interface Form {
  name: WritableSignal<string>;
  email: WritableSignal<string>;
  phone: WritableSignal<string>;
  notes: WritableSignal<string>;
  codeText: WritableSignal<string>;
  discount: WritableSignal<string>;
  quantity: WritableSignal<string>;
  existing: WritableSignal<string | null>;
  codeOptions: () => { id: string; label: string }[];
  pickMode: (mode: string) => void;
  valid: () => boolean;
  submit: () => void;
}

describe('dba-referral-form', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const persona = (form: Form) => {
    form.name.set('Ana Gómez');
    form.email.set('ana@aliados.co');
  };

  it('con código nuevo exige los datos del código y los envía anidados', () => {
    const fixture = TestBed.createComponent(ReferralFormComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Form;
    const creados: unknown[] = [];
    fixture.componentInstance.created.subscribe((body) => creados.push(body));

    persona(form);
    expect(form.valid()).toBe(false);
    form.codeText.set('ANA15');
    form.discount.set('15');
    form.quantity.set('50');
    expect(form.valid()).toBe(true);
    form.submit();
    expect(creados[0]).toMatchObject({
      name: 'Ana Gómez',
      email: 'ana@aliados.co',
      code: { code: 'ANA15', discount: 15, quantity: 50 },
    });
    expect(creados[0]).not.toHaveProperty('promotionalCodeId');
  });

  it('con código existente busca opciones y envía solo su id', async () => {
    const fixture = TestBed.createComponent(ReferralFormComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Form;
    const creados: unknown[] = [];
    fixture.componentInstance.created.subscribe((body) => creados.push(body));

    persona(form);
    form.pickMode('existing');
    http
      .expectOne((r) => r.url === '/platform/promotional-codes')
      .flush({ total: 1, items: [codigo()] });
    await vi.waitFor(() => expect(form.codeOptions()).toHaveLength(1));
    expect(form.codeOptions()[0]?.label).toBe('LANZA20 · 20 %');
    expect(form.valid()).toBe(false);

    form.existing.set('p1');
    expect(form.valid()).toBe(true);
    form.submit();
    expect(creados[0]).toMatchObject({ promotionalCodeId: 'p1' });
    expect(creados[0]).not.toHaveProperty('code');
  });

  it('al editar, lo que se vacía viaja como null para borrarlo', () => {
    const fixture = TestBed.createComponent(ReferralFormComponent);
    fixture.componentRef.setInput('referral', referido());
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Form;
    const editados: unknown[] = [];
    fixture.componentInstance.updated.subscribe((body) => editados.push(body));

    expect(form.valid()).toBe(true);
    form.phone.set(' ');
    form.notes.set('');
    form.submit();
    expect(editados[0]).toEqual({
      name: 'Ana Gómez',
      email: 'ana@aliados.co',
      phone: null,
      document: '1020304050',
      notes: null,
    });
  });

  it('rechaza un correo mal escrito', () => {
    const fixture = TestBed.createComponent(ReferralFormComponent);
    fixture.componentRef.setInput('referral', referido());
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Form;
    form.email.set('ana@aliados');
    expect(form.valid()).toBe(false);
  });
});
