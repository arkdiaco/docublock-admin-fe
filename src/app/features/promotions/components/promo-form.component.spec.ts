import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { WritableSignal } from '@angular/core';
import { codigo, configurar } from '../pages/promotions-test-kit';
import { PromoFormComponent } from './promo-form.component';

interface Form {
  name: WritableSignal<string>;
  codeText: WritableSignal<string>;
  discount: WritableSignal<string>;
  quantity: WritableSignal<string>;
  expires: WritableSignal<string>;
  valid: () => boolean;
  quantityProblem: () => boolean;
  submit: () => void;
}

describe('dba-promo-form', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  it('al crear exige código válido, descuento de 1 a 100 y cantidad', () => {
    const fixture = TestBed.createComponent(PromoFormComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Form;
    const creados: unknown[] = [];
    fixture.componentInstance.created.subscribe((body) => creados.push(body));

    form.name.set('Lanzamiento');
    form.codeText.set('a b');
    form.discount.set('120');
    form.quantity.set('5');
    expect(form.valid()).toBe(false);

    form.codeText.set('LANZA20');
    form.discount.set('20');
    expect(form.valid()).toBe(true);
    form.submit();
    expect(creados).toEqual([
      expect.objectContaining({ name: 'Lanzamiento', code: 'LANZA20', discount: 20, quantity: 5 }),
    ]);
  });

  it('al editar no deja bajar la cantidad de lo ya canjeado', () => {
    const fixture = TestBed.createComponent(PromoFormComponent);
    fixture.componentRef.setInput('code', codigo({ redeemed: 4, quantity: 10 }));
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as Form;
    const editados: unknown[] = [];
    fixture.componentInstance.updated.subscribe((body) => editados.push(body));

    form.quantity.set('3');
    expect(form.quantityProblem()).toBe(true);
    expect(form.valid()).toBe(false);

    form.quantity.set('4');
    expect(form.valid()).toBe(true);
    form.submit();
    expect(editados).toEqual([expect.objectContaining({ quantity: 4, discount: 20 })]);
    expect(editados[0]).not.toHaveProperty('code');
  });
});
