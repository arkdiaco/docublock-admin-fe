import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';
import {
  INVOICE_STATUSES,
  TRANSACTION_STATUSES,
  transactionFamilyOf,
  transactionStatusKey,
} from '../../shared/domain/billing-status';
import { moneyExact } from '../../shared/domain/money';
import { BILLING_ERRORS } from './data/billing-errors';
import { MANUAL_INTERVALS, REVENUE_SOURCES, type ManualPlanOption } from './data/billing.models';
import {
  RANGE_PRESETS,
  REFERENCE_PATTERN,
  TRANSACTION_VIEWS,
  allowedNextOf,
  canCreateInvoice,
  canToggleInvoiced,
  catalogPriceOf,
  countOf,
  invoiceTotalsOf,
  isTransactionView,
  lineAmountOf,
  numberOf,
  presetRange,
} from './data/billing-view';

const leaf = (catalog: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      catalog,
    );

const hojas = (node: unknown, prefix = ''): string[] =>
  Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : hojas(value, `${prefix}${key}.`),
  );

const plan = (over: Partial<ManualPlanOption> = {}): ManualPlanOption => ({
  code: 'pro',
  name: 'Profesional',
  kind: 'SUBSCRIPTION',
  currency: 'COP',
  priceMonthly: 100,
  priceAnnual: 1000,
  priceOnce: null,
  limits: { documents: 50 },
  ...over,
});

describe('Facturación: reglas puras', () => {
  it('solo lo pendiente o rechazado cambia de estado; lo aprobado, anulado o con error es final', () => {
    expect(allowedNextOf('PENDING')).toEqual(['APPROVED', 'DECLINED', 'VOIDED']);
    expect(allowedNextOf('DECLINED')).toEqual(['APPROVED', 'VOIDED']);
    expect(allowedNextOf('APPROVED')).toEqual([]);
    expect(allowedNextOf('VOIDED')).toEqual([]);
    expect(allowedNextOf('ERROR')).toEqual([]);
  });

  it('la marca manual solo existe sin factura vinculada', () => {
    const base = { status: 'APPROVED' as const, invoiced: false, invoice: null };
    expect(canToggleInvoiced(base)).toBe(true);
    expect(canToggleInvoiced({ ...base, invoice: { id: 'f1' } })).toBe(false);
    expect(canToggleInvoiced({ ...base, status: 'PENDING' })).toBe(false);
    expect(canToggleInvoiced({ ...base, status: 'PENDING', invoiced: true })).toBe(true);
  });

  it('solo se crea factura para una aprobada sin factura ni marca', () => {
    const base = { status: 'APPROVED' as const, invoiced: false, invoice: null };
    expect(canCreateInvoice(base)).toBe(true);
    expect(canCreateInvoice({ ...base, invoiced: true })).toBe(false);
    expect(canCreateInvoice({ ...base, invoice: { id: 'f1' } })).toBe(false);
    expect(canCreateInvoice({ ...base, status: 'DECLINED' })).toBe(false);
  });

  it('el precio de catálogo depende del tipo de plan y del intervalo', () => {
    expect(catalogPriceOf(plan(), 'monthly')).toBe(100);
    expect(catalogPriceOf(plan(), 'annual')).toBe(1000);
    expect(catalogPriceOf(plan(), 'once')).toBeNull();
    expect(catalogPriceOf(plan({ priceMonthly: 0 }), 'monthly')).toBeNull();
    const paquete = plan({ kind: 'PACKAGE', priceOnce: 70 });
    expect(catalogPriceOf(paquete, 'once')).toBe(70);
    expect(catalogPriceOf(paquete, 'monthly')).toBeNull();
  });

  it('los totales de la factura redondean a centavos', () => {
    expect(lineAmountOf({ quantity: 3, unitPrice: 0.1 })).toBe(0.3);
    expect(
      invoiceTotalsOf(
        [
          { quantity: 2, unitPrice: 100 },
          { quantity: 1, unitPrice: 0.5 },
        ],
        [{ amount: 38.1 }],
      ),
    ).toEqual({ subtotal: 200.5, taxes: 38.1, total: 238.6 });
  });

  it('lee números con coma o punto y rechaza lo que no lo es', () => {
    expect(numberOf('1200,5')).toBe(1200.5);
    expect(numberOf(' 7 ')).toBe(7);
    expect(numberOf('')).toBeNaN();
    expect(numberOf('abc')).toBeNaN();
  });

  it('la referencia acepta lo que acepta el servicio', () => {
    expect(REFERENCE_PATTERN.test('REF_2026-01')).toBe(true);
    expect(REFERENCE_PATTERN.test('abc')).toBe(false);
    expect(REFERENCE_PATTERN.test('con espacio')).toBe(false);
  });

  it('los periodos arrancan el primer día que les toca', () => {
    const ahora = new Date(2026, 10, 15, 12);
    expect(new Date(presetRange('mes', ahora).from)).toEqual(new Date(2026, 10, 1));
    expect(new Date(presetRange('anio', ahora).from)).toEqual(new Date(2026, 0, 1));
    expect(new Date(presetRange('ultimos-12', ahora).from)).toEqual(new Date(2025, 11, 1));
    expect(new Date(presetRange('mes', ahora).to)).toEqual(ahora);
  });

  it('cuenta varios estados juntos', () => {
    const porEstado = [
      { status: 'DECLINED', count: 2 },
      { status: 'VOIDED', count: 1 },
      { status: 'APPROVED', count: 9 },
    ];
    expect(countOf(porEstado, ['DECLINED', 'VOIDED', 'ERROR'])).toBe(3);
  });

  it('reconoce las vistas por su nombre', () => {
    expect(isTransactionView('sin-facturar')).toBe(true);
    expect(isTransactionView('otra')).toBe(false);
    expect(isTransactionView(null)).toBe(false);
  });

  it('un estado que no conocemos no pinta una llave cruda', () => {
    expect(transactionStatusKey('APPROVED')).toBe('billing.txStatus.APPROVED');
    expect(transactionStatusKey('RARO')).toBe('billing.txStatus.UNKNOWN');
    expect(transactionFamilyOf('RARO')).toBe('closed');
    expect(leaf(es, 'billing.txStatus.UNKNOWN')).toBeTruthy();
  });

  it('el monto conserva los centavos que tenga, sin inventarlos', () => {
    expect(moneyExact(1200.5, 'USD', 'es')).toContain('1200,5');
    expect(moneyExact(1200, 'USD', 'es')).not.toContain(',');
  });
});

describe('Facturación: textos', () => {
  it('es y en tienen exactamente las mismas llaves', () => {
    expect(hojas(en.billing).sort()).toEqual(hojas(es.billing).sort());
  });

  it('no queda ningún texto vacío', () => {
    for (const catalog of [es, en])
      for (const key of hojas(catalog.billing))
        expect(String(leaf(catalog.billing, key)).trim()).not.toBe('');
  });

  it('hay texto para cada estado, origen, intervalo, vista, periodo y error', () => {
    const llaves = [
      ...TRANSACTION_STATUSES.map((s) => `billing.txStatus.${s}`),
      ...INVOICE_STATUSES.map((s) => `billing.invStatus.${s}`),
      ...REVENUE_SOURCES.map((s) => `billing.source.${s}`),
      ...MANUAL_INTERVALS.map((s) => `billing.interval.${s}`),
      ...TRANSACTION_VIEWS.map((s) => `billing.tx.view.${s}`),
      ...RANGE_PRESETS.map((s) => `billing.rev.preset.${s}`),
      ...BILLING_ERRORS.map((s) => `billing.error.${s}`),
    ];
    for (const key of llaves) {
      expect(leaf(es, key), key).toBeTruthy();
      expect(leaf(en, key), key).toBeTruthy();
    }
  });

  it('los botones de confirmar no llevan parámetros: el diálogo no los interpola', () => {
    const confirmaciones = [
      'billing.tx.reconcile.confirm',
      'billing.td.act.APPROVED.confirm',
      'billing.td.act.DECLINED.confirm',
      'billing.td.act.VOIDED.confirm',
      'billing.td.act.markInvoiced.confirm',
      'billing.td.act.unmarkInvoiced.confirm',
      'billing.id.void.confirm',
    ];
    for (const key of confirmaciones) expect(String(leaf(es, key))).not.toContain('{{');
  });

  it('la ficha de la organización rotula su pestaña', () => {
    expect(leaf(es, 'orgd.tab.billing')).toBe('Facturación');
    expect(leaf(en, 'orgd.tab.billing')).toBe('Billing');
  });
});
