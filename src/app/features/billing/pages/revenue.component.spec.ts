import type { HttpRequest } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RevenueComponent } from './revenue.component';
import { conPermisos, configurar, resumenIngresos } from './billing-test-kit';
import type { PaymentConfigStatus, RevenueRow, RevenueSummary } from '../data/billing.models';

const FILA: RevenueRow = {
  id: 'tx1',
  idTransaction: 'ALO-1',
  source: 'alohapay',
  status: 'APPROVED',
  amountMajor: 250000,
  currency: 'COP',
  organization: { id: 'o1', name: 'Notaría 14' },
  plan: { id: 'pro', name: 'Profesional' },
  requestDate: '2026-10-29T10:00:00.000Z',
};

const CONFIG: PaymentConfigStatus = {
  gateways: {
    stripeConfigured: true,
    webhookSecretConfigured: false,
    forwardSigningConfigured: true,
    coreForwardTarget: true,
    alohapayConfigured: true,
    alohapayWebhookConfigured: true,
  },
  issuerMissing: ['taxId'],
};

const isSummary = (r: HttpRequest<unknown>) => r.url === '/platform/revenue/summary';
const isList = (r: HttpRequest<unknown>) => r.url === '/platform/revenue/transactions';

describe('Comercial › Facturación › ingresos', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    http = await configurar();
    conPermisos(['platform:commercial']);
  });

  afterEach(() => http.verify());

  const montar = async (
    resumen: RevenueSummary = resumenIngresos(),
    config: PaymentConfigStatus = CONFIG,
    total = 1,
  ) => {
    const fixture = TestBed.createComponent(RevenueComponent);
    fixture.detectChanges();
    http.expectOne(isSummary).flush(resumen);
    http.expectOne(isList).flush({ total, items: [FILA] });
    http.expectOne('/platform/billing/config').flush(config);
    const host = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.querySelector('dba-data-table')).not.toBeNull();
      expect(host.querySelector('.cfg__list')).not.toBeNull();
    });
    return { fixture, host };
  };

  it('muestra totales, rechazadas sumadas y bloques por moneda', async () => {
    const { host } = await montar();
    expect(host.textContent).toContain('Ingresos COP');
    expect(host.textContent).toContain('500,000');
    expect(host.textContent).toContain('Aprobadas: 2');
    expect(host.querySelectorAll('.rv__card').length).toBe(4);
    expect(host.textContent).toContain('AlohaPay');
    expect(host.textContent).not.toContain('billing.');
  });

  it('con dos monedas elige y no las mezcla', async () => {
    const { fixture, host } = await montar(
      resumenIngresos({
        totals: [
          { currency: 'COP', gross: 500000, count: 2 },
          { currency: 'USD', gross: 40, count: 1 },
        ],
        byPlan: [
          { plan: 'pro', name: 'Profesional', currency: 'COP', gross: 500000, count: 2 },
          { plan: 'usd', name: 'Internacional', currency: 'USD', gross: 40, count: 1 },
        ],
      }),
    );
    expect(host.textContent).toContain('Ingresos USD');
    const planes = () => host.querySelectorAll('.rv__card')[2].textContent ?? '';
    expect(planes()).toContain('Profesional');
    expect(planes()).not.toContain('Internacional');
    (
      fixture.componentInstance as unknown as { currencyChoice: { set: (c: string) => void } }
    ).currencyChoice.set('USD');
    fixture.detectChanges();
    expect(planes()).toContain('Internacional');
    expect(planes()).not.toContain('Profesional');
  });

  it('avisa el recorte de 20 000 filas', async () => {
    const { host } = await montar(resumenIngresos({ capped: true }), CONFIG, 20000);
    expect(host.textContent).toContain('supera las 20 000 transacciones');
    expect(host.textContent).toContain('El CSV llega hasta 20 000 filas');
  });

  it('sin ingresos aprobados no inventa barras', async () => {
    const { host } = await montar(
      resumenIngresos({ totals: [], byMonth: [], byPlan: [], byProvider: [], byOrganization: [] }),
    );
    expect(host.textContent).toContain('Sin ingresos aprobados en este periodo.');
    expect(host.querySelector('.rv__card')).toBeNull();
  });

  it('la configuración dice qué falta sin mostrar secretos', async () => {
    const { host } = await montar();
    const panel = host.querySelector('dba-payment-config-panel')?.textContent ?? '';
    expect(panel).toContain('Webhook de Stripe');
    expect(panel).toContain('Falta');
    expect(panel).toContain('Falta: NIT');
  });

  it('si commons no responde lo dice en vez de pintar todo en falta', async () => {
    const { host } = await montar(resumenIngresos(), { gateways: null, issuerMissing: [] });
    const panel = host.querySelector('dba-payment-config-panel')?.textContent ?? '';
    expect(panel).toContain('El servicio de pagos no respondió');
    expect(panel).not.toContain('Webhook de Stripe');
  });

  it('un rango al revés no pide nada', async () => {
    const { fixture, host } = await montar();
    const componente = fixture.componentInstance as unknown as {
      pickPreset: (p: string) => void;
      setDate: (t: { set: (v: string) => void }, v: string) => void;
      from: { set: (v: string) => void };
      to: { set: (v: string) => void };
    };
    componente.from.set('2026-10-10');
    componente.to.set('2026-10-01');
    componente.pickPreset('personalizado');
    fixture.detectChanges();
    http.expectNone(isSummary);
    http.expectNone(isList);
    expect(host.textContent).toContain('La fecha inicial es posterior a la final.');
  });
});
