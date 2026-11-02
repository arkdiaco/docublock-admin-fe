import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { TransactionDetailComponent } from './transaction-detail.component';
import { conPermisos, configurar, fichaTransaccion } from './billing-test-kit';

const URL_FICHA = '/platform/transactions/tx1';

describe('Comercial › Facturación › ficha de la transacción', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const montar = async (ficha = fichaTransaccion()) => {
    const fixture = TestBed.createComponent(TransactionDetailComponent);
    fixture.componentRef.setInput('id', 'tx1');
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

  it('muestra solo las transiciones permitidas', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar();
    expect(etiquetas(host)).toEqual(['Aprobar', 'Rechazar', 'Anular']);
  });

  it('una aprobada no cambia de estado y sin factura deja marcarla', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar(fichaTransaccion({ status: 'APPROVED' }));
    expect(etiquetas(host)).toEqual(['Marcar como facturada']);
  });

  it('con factura vinculada no hay marca manual', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar(
      fichaTransaccion({
        status: 'APPROVED',
        invoiced: true,
        invoice: { id: 'f1', invoiceNumber: 'FAC-1', status: 'sent' },
      }),
    );
    expect(host.querySelector('.bd__actions')).toBeNull();
  });

  it('solo lectura: sin acciones', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(host.querySelector('.bd__actions')).toBeNull();
  });

  it('aprobar confirma avisando lo que va a pasar y recarga', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const confirmar = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const { fixture, host } = await montar();
    host.querySelector<HTMLButtonElement>('.bd__actions button')?.click();
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    expect(confirmar.mock.calls[0][0]).toMatchObject({
      intent: 'primary',
      title: 'billing.td.act.APPROVED.title',
      params: { org: 'Notaría 14' },
    });
    await vi.waitFor(() => {
      const pedido = http.expectOne(`${URL_FICHA}/status`);
      expect(pedido.request.body).toEqual({ status: 'APPROVED' });
      pedido.flush(fichaTransaccion({ status: 'APPROVED' }));
    });
    await vi.waitFor(() => {
      http.expectOne(URL_FICHA).flush(fichaTransaccion({ status: 'APPROVED' }));
    });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(etiquetas(host)).toEqual(['Marcar como facturada']);
    });
  });

  it('un 404 lleva al estado de no existe', async () => {
    conPermisos(['platform:commercial']);
    const fixture = TestBed.createComponent(TransactionDetailComponent);
    fixture.componentRef.setInput('id', 'tx1');
    fixture.detectChanges();
    http.expectOne(URL_FICHA).flush({}, { status: 404, statusText: 'Not Found' });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain('Esa transacción no existe');
    });
  });
});
