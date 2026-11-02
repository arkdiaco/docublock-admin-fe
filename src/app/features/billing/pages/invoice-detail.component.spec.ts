import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { InvoiceDetailComponent } from './invoice-detail.component';
import { conPermisos, configurar, factura } from './billing-test-kit';

const URL_FICHA = '/platform/invoices/f1';

describe('Comercial › Facturación › ficha de la factura', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (ficha = factura()) => {
    const fixture = TestBed.createComponent(InvoiceDetailComponent);
    fixture.componentRef.setInput('id', 'f1');
    fixture.detectChanges();
    http.expectOne(URL_FICHA).flush(ficha);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-record-header')).not.toBeNull();
    });
    return { fixture, host };
  };

  const etiquetas = (host: HTMLElement) =>
    [...host.querySelectorAll('.bd__actions button')].map((b) => b.textContent?.trim());

  it('un borrador se edita, se envía y se anula', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar();
    expect(etiquetas(host)).toEqual(['Ver PDF', 'Editar', 'Enviar', 'Anular']);
    expect(host.textContent).toContain('Plan Profesional');
    expect(host.textContent).toContain('IVA 19%');
    expect(host.textContent).toContain('297,500');
  });

  it('una enviada se reenvía pero ya no se edita', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar(factura({ status: 'sent' }));
    expect(etiquetas(host)).toEqual(['Ver PDF', 'Reenviar', 'Anular']);
  });

  it('una anulada solo deja ver el PDF', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar(factura({ status: 'void' }));
    expect(etiquetas(host)).toEqual(['Ver PDF']);
  });

  it('solo lectura: solo el PDF', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(etiquetas(host)).toEqual(['Ver PDF']);
  });

  it('anular confirma como acción peligrosa', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const confirmar = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const { fixture, host } = await montar();
    [...host.querySelectorAll<HTMLButtonElement>('.bd__actions button')]
      .find((b) => b.textContent?.includes('Anular'))
      ?.click();
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    expect(confirmar.mock.calls[0][0]).toMatchObject({
      intent: 'danger',
      params: { number: 'FAC-000001' },
    });
    await vi.waitFor(() => {
      http.expectOne(`${URL_FICHA}/void`).flush(factura({ status: 'void' }));
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(etiquetas(host)).toEqual(['Ver PDF']);
    });
  });

  it('un PDF fallido cierra la pestaña y avisa', async () => {
    conPermisos(['platform:commercial']);
    const pestana = { close: vi.fn(), location: { href: '' } };
    vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window);
    const { host } = await montar();
    host.querySelector<HTMLButtonElement>('.bd__actions button')?.click();
    await vi.waitFor(() => {
      http.expectOne(`${URL_FICHA}/pdf`).flush(new Blob(), { status: 500, statusText: 'Error' });
    });
    await vi.waitFor(() => expect(pestana.close).toHaveBeenCalled());
  });
});
