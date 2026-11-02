import type { HttpRequest } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DialogService } from '../../../core/ui/dialog.service';
import { NotificationService } from '../../../core/ui/notification.service';
import { TransactionsComponent } from './transactions.component';
import { conPermisos, configurar, transaccion } from './billing-test-kit';

const isList = (r: HttpRequest<unknown>) => r.url === '/platform/transactions';
const isCount = (r: HttpRequest<unknown>) => isList(r) && r.params.get('limit') === '1';
const isMain = (r: HttpRequest<unknown>) => isList(r) && r.params.get('limit') === '20';

describe('Comercial › Facturación › transacciones', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
  });

  afterEach(() => http.verify());

  const contar = (total = 2) => {
    http.match(isCount).forEach((request) => request.flush({ total, items: [] }));
  };

  const montar = async (filas = [transaccion()]) => {
    const fixture = TestBed.createComponent(TransactionsComponent);
    fixture.detectChanges();
    contar();
    http.expectOne(isMain).flush({ total: filas.length, items: filas });
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table, dba-empty-state')).not.toBeNull();
    });
    return { fixture, host };
  };

  const texto = (host: HTMLElement) => host.textContent ?? '';
  const botones = (host: HTMLElement) =>
    [...host.querySelectorAll('button')].map((b) => b.textContent?.trim());

  it('lista con monto real, origen e intervalo traducidos', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(texto(host)).toContain('REF-001');
    expect(texto(host)).toContain('Notaría 14');
    expect(texto(host)).toContain('Manual');
    expect(texto(host)).toContain('Mensual');
    expect(texto(host)).toContain('250,000');
    expect(texto(host)).toContain('Pendiente');
  });

  it('un estado desconocido no pinta llaves', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar([
      transaccion({ status: 'RARO' as never, planDuration: 'semanal' }),
    ]);
    expect(texto(host)).toContain('Sin identificar');
    expect(texto(host)).toContain('semanal');
    expect(texto(host)).not.toContain('billing.');
  });

  it('solo lectura: no hay conciliar ni pago manual', async () => {
    conPermisos(['platform:commercial']);
    const { host } = await montar();
    expect(botones(host)).not.toContain('Conciliar con AlohaPay');
    expect(botones(host)).not.toContain('Registrar pago manual');
  });

  it('sin leer clientes no hay selector de organización ni pago manual', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const { host } = await montar();
    expect(host.querySelector('dba-org-picker')).toBeNull();
    expect(botones(host)).toContain('Conciliar con AlohaPay');
    expect(botones(host)).not.toContain('Registrar pago manual');
  });

  it('con gestión y clientes aparece todo', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage', 'platform:clients']);
    const { host } = await montar();
    expect(host.querySelector('dba-org-picker')).not.toBeNull();
    expect(botones(host)).toContain('Registrar pago manual');
  });

  it('una vista filtra por su estado y una fecha al revés no pide nada', async () => {
    conPermisos(['platform:commercial']);
    const { fixture, host } = await montar();
    const celdas = host.querySelectorAll<HTMLElement>('db-stat-band button');
    const pendientes = [...celdas].find((c) => c.textContent?.includes('Pendientes'));
    pendientes?.click();
    fixture.detectChanges();
    const pedido = http.expectOne(isMain);
    expect(pedido.request.params.get('status')).toBe('PENDING');
    pedido.flush({ total: 0, items: [] });
    await fixture.whenStable();
    const componente = fixture.componentInstance as unknown as {
      setDate: (t: { set: (v: string) => void }, v: string) => void;
      from: { set: (v: string) => void };
      to: { set: (v: string) => void };
    };
    componente.from.set('2026-10-10');
    componente.setDate(componente.to, '2026-10-01');
    fixture.detectChanges();
    http.expectNone(isList);
    expect(texto(host)).toContain('La fecha inicial es posterior a la final.');
  });

  it('conciliar pide confirmación y resume el resultado', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage']);
    const dialogs = TestBed.inject(DialogService);
    const confirmar = vi.spyOn(dialogs, 'confirm').mockResolvedValue(true);
    const aviso = vi.spyOn(TestBed.inject(NotificationService), 'success');
    const { fixture, host } = await montar();
    [...host.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Conciliar con AlohaPay'))
      ?.click();
    await vi.waitFor(() => expect(confirmar).toHaveBeenCalled());
    await vi.waitFor(() => {
      http
        .expectOne('/platform/transactions/reconcile')
        .flush({ checked: 2, repaired: [{ id: 'a', status: 'APPROVED' }], failed: [] });
    });
    await vi.waitFor(() => {
      contar();
      const pedidos = http.match(isMain);
      pedidos.forEach((p) => p.flush({ total: 1, items: [transaccion()] }));
      expect(pedidos.length).toBeGreaterThan(0);
    });
    fixture.detectChanges();
    expect(aviso).toHaveBeenCalledWith('Revisadas: 2. Corregidas: 1. Con error: 0.');
  });

  it('?pago=1 abre el pago manual con la organización de la URL y limpia el parámetro', async () => {
    conPermisos(['platform:commercial', 'platform:commercial:manage', 'platform:clients']);
    const router = TestBed.inject(Router);
    router.resetConfig([{ path: 'x', component: TransactionsComponent }]);
    const harness = await RouterTestingHarness.create('/x?pago=1&organizacion=o1');
    const host = harness.routeNativeElement as HTMLElement;
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(host.querySelector('dba-manual-payment-form')).not.toBeNull();
    });
    expect(router.url).toBe('/x?organizacion=o1');
    const lista = http.match(isMain);
    expect(lista[0].request.params.get('organizationId')).toBe('o1');
    http.match((r) => r.url === '/platform/plans').forEach((p) => p.flush([]));
    http.match(() => true).forEach((p) => p.flush({ total: 0, items: [] }));
    lista.forEach((p) => p.flush({ total: 0, items: [] }));
  });
});
