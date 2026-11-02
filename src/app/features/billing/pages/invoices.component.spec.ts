import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InvoicesComponent } from './invoices.component';
import { conPermisos, configurar, factura } from './billing-test-kit';

describe('Comercial › Facturación › facturas', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async () => {
    const fixture = TestBed.createComponent(InvoicesComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/platform/invoices')
      .flush({ total: 1, items: [factura({ sentTo: 'pagos@notaria14.co' })] });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table')).not.toBeNull();
    });
    return { fixture, host };
  };

  it('lista número, cliente, total y estado', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(host.textContent).toContain('FAC-000001');
    expect(host.textContent).toContain('Notaría 14');
    expect(host.textContent).toContain('297,500');
    expect(host.textContent).toContain('Borrador');
    expect(host.textContent).not.toContain('Nueva factura');
  });

  it('con gestión abre el formulario; sin organización exige nombre y correo', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { fixture, host } = await montar();
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Nueva factura'))
      ?.click();
    fixture.detectChanges();
    expect(host.querySelector('dba-invoice-form')).not.toBeNull();
    expect(host.querySelector('dba-invoice-form dba-org-picker')).toBeNull();
    expect(host.textContent).toContain('Requerido si no eliges organización.');
  });
});
