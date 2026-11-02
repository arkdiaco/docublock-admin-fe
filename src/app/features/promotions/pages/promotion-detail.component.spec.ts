import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { PromotionDetailComponent } from './promotion-detail.component';
import { codigo, conPermisos, configurar, reporte } from './promotions-test-kit';

const BASE = '/platform/promotional-codes/p1';

interface Ficha {
  deactivate: () => Promise<void>;
  tab: { set: (tab: string) => void };
}

describe('Comercial › Promocionales › ficha', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (item = codigo(), report = reporte()) => {
    const fixture = TestBed.createComponent(PromotionDetailComponent);
    fixture.componentRef.setInput('id', 'p1');
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([{ id: 'co', name: 'Colombia' }]);
    http.expectOne(BASE).flush(item);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-promo-report')).not.toBeNull();
    });
    fixture.detectChanges();
    http.expectOne((r) => r.url === `${BASE}/report`).flush(report);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('db-stat-band')).not.toBeNull();
    });
    return { fixture, host, page: fixture.componentInstance as unknown as Ficha };
  };

  it('muestra los datos y separa los totales por moneda', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(host.textContent).toContain('LANZA20');
    expect(host.textContent).toContain('Periodo en COP');
    expect(host.textContent).toContain('Periodo en USD');
    expect(host.textContent).toContain('REF-1');
    expect(host.textContent).not.toContain('Editar');
    expect(host.querySelector('a[href*="/clientes/"]')).toBeNull();
  });

  it('si el código tiene dueño lo enlaza a su referido', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar(codigo(), reporte({ referrer: { id: 'r1', name: 'Ana Gómez' } }));
    expect(host.textContent).toContain('Ana Gómez');
    expect(host.querySelector('a[href*="/comercial/referidos/r1"]')).not.toBeNull();
  });

  it('desactivar pide confirmación y manda active=false', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const confirmar = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const { fixture, page } = await montar();
    const accion = page.deactivate();
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    const req = await vi.waitFor(() => http.expectOne((r) => r.method === 'PUT'));
    expect(req.request.body).toEqual({ active: false });
    req.flush(codigo({ active: false }));
    await accion;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Inactivo');
  });

  it('avisa cuando el contador supera los canjes registrados', async () => {
    conPermisos(['platform:commercial']);
    const { fixture, host, page } = await montar(codigo({ redeemed: 5 }));
    page.tab.set('redemptions');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === `${BASE}/redemptions`)
      .flush({
        total: 1,
        items: [
          {
            id: 'x1',
            discount: 20,
            organizationId: 'o1',
            organizationName: 'Notaría 14',
            reference: 'REF-1',
            createdAt: '2026-10-20T10:00:00.000Z',
          },
        ],
      });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Notaría 14');
    });
    expect(host.textContent).toContain('Canjeados según el contador: 5. Con detalle: 1.');
  });

  it('un código inexistente muestra su estado vacío', async () => {
    conPermisos(['platform:commercial']);
    const fixture = TestBed.createComponent(PromotionDetailComponent);
    fixture.componentRef.setInput('id', 'p1');
    fixture.detectChanges();
    http.expectOne('/catalogs/countries').flush([]);
    http.expectOne(BASE).flush({}, { status: 404, statusText: 'Not Found' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Este código no existe');
    });
  });
});
