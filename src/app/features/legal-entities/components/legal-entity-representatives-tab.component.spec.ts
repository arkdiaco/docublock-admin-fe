import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { conPermisos, configurar, ficha } from '../pages/legal-entities-test-kit';
import { LegalEntityRepresentativesTabComponent } from './legal-entity-representatives-tab.component';

interface Interno {
  add(value: { signerId: string; isLegalRep: boolean; reason: string }): Promise<void>;
  acting: { set(value: unknown): void };
  onAction(key: string): void;
  linked(): string[];
  actionItems(): { key: string; labelKey: string }[];
}

describe('Entidades jurídicas › Representantes', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:clients:manage']);
  });

  afterEach(() => http.verify());

  const montar = () => {
    const fixture = TestBed.createComponent(LegalEntityRepresentativesTabComponent);
    fixture.componentRef.setInput('entity', ficha());
    fixture.detectChanges();
    return { fixture, interno: fixture.componentInstance as unknown as Interno };
  };

  it('agrega y avisa a la ficha', async () => {
    const { fixture, interno } = montar();
    const cambios: unknown[] = [];
    fixture.componentInstance.changed.subscribe((value) => cambios.push(value));
    const hecho = interno.add({ signerId: 's2', isLegalRep: false, reason: 'Poder' });
    const pedido = http.expectOne('/platform/legal-entities/e1/representatives');
    expect(pedido.request.body).toEqual({ signerId: 's2', isLegalRep: false, reason: 'Poder' });
    pedido.flush(ficha());
    await hecho;
    expect(cambios).toHaveLength(1);
  });

  it('el menú ofrece el rol contrario y quitar', () => {
    const { interno } = montar();
    interno.acting.set(ficha().representatives[0]);
    expect(interno.actionItems().map((item) => item.labelKey)).toEqual([
      'jur.representatives.menu.toProxy',
      'jur.representatives.menu.remove',
    ]);
    expect(interno.linked()).toEqual(['s1']);
  });

  it('cambiar el rol pide motivo y envía el contrario', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Cambio',
    });
    const { interno } = montar();
    interno.acting.set(ficha().representatives[0]);
    interno.onAction('role');
    const pedido = await vi.waitFor(() =>
      http.expectOne('/platform/legal-entities/e1/representatives/s1'),
    );
    expect(pedido.request.method).toBe('PATCH');
    expect(pedido.request.body).toEqual({ isLegalRep: false, reason: 'Cambio' });
    pedido.flush(ficha());
  });

  it('quitar pide motivo y usa DELETE', async () => {
    vi.spyOn(TestBed.inject(DialogService), 'open').mockResolvedValue({
      answer: 'confirm',
      reason: 'Salió',
    });
    const { interno } = montar();
    interno.acting.set(ficha().representatives[0]);
    interno.onAction('remove');
    const pedido = await vi.waitFor(() =>
      http.expectOne('/platform/legal-entities/e1/representatives/s1'),
    );
    expect(pedido.request.method).toBe('DELETE');
    expect(pedido.request.body).toEqual({ reason: 'Salió' });
    pedido.flush(ficha({ representatives: [] }));
  });
});
