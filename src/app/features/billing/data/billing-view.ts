import type { TransactionStatus } from '../../../shared/domain/billing-status';
import {
  MANUAL_INTERVALS,
  type InvoiceItem,
  type ManualInterval,
  type ManualPlanOption,
  type TaxAmount,
  type TransactionsQuery,
} from './billing.models';

export type TransactionView = 'todas' | 'pendientes' | 'aprobadas' | 'sin-facturar';

export const TRANSACTION_VIEWS: readonly TransactionView[] = [
  'todas',
  'pendientes',
  'aprobadas',
  'sin-facturar',
];

export const VIEW_QUERY: Record<TransactionView, Partial<TransactionsQuery>> = {
  todas: {},
  pendientes: { status: 'PENDING' },
  aprobadas: { status: 'APPROVED' },
  'sin-facturar': { status: 'APPROVED', invoiced: false },
};

export const isTransactionView = (value: string | null): value is TransactionView =>
  TRANSACTION_VIEWS.includes(value as TransactionView);

export const allowedNextOf = (status: TransactionStatus): TransactionStatus[] => {
  if (status === 'PENDING') return ['APPROVED', 'DECLINED', 'VOIDED'];
  if (status === 'DECLINED') return ['APPROVED', 'VOIDED'];
  return [];
};

export const canToggleInvoiced = (tx: {
  status: TransactionStatus;
  invoiced?: boolean;
  invoice: unknown;
}): boolean => !tx.invoice && (tx.status === 'APPROVED' || !!tx.invoiced);

export const canCreateInvoice = (tx: {
  status: TransactionStatus;
  invoiced?: boolean;
  invoice: unknown;
}): boolean => !tx.invoice && !tx.invoiced && tx.status === 'APPROVED';

export const isManualInterval = (value: string): value is ManualInterval =>
  MANUAL_INTERVALS.includes(value as ManualInterval);

export const catalogPriceOf = (plan: ManualPlanOption, interval: ManualInterval): number | null => {
  if (interval === 'once')
    return plan.kind === 'PACKAGE' && plan.priceOnce !== null && plan.priceOnce > 0
      ? plan.priceOnce
      : null;
  if (plan.kind !== 'SUBSCRIPTION') return null;
  const price = interval === 'annual' ? plan.priceAnnual : plan.priceMonthly;
  return price > 0 ? price : null;
};

export const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{4,80}$/;

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const lineAmountOf = (line: Pick<InvoiceItem, 'quantity' | 'unitPrice'>): number =>
  roundMoney(roundMoney(line.quantity) * roundMoney(line.unitPrice));

export const invoiceTotalsOf = (
  lines: readonly Pick<InvoiceItem, 'quantity' | 'unitPrice'>[],
  taxes: readonly Pick<TaxAmount, 'amount'>[],
): { subtotal: number; taxes: number; total: number } => {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + lineAmountOf(line), 0));
  const taxTotal = roundMoney(taxes.reduce((sum, tax) => sum + tax.amount, 0));
  return { subtotal, taxes: taxTotal, total: roundMoney(subtotal + taxTotal) };
};

export const numberOf = (text: string): number => {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) ? Number.NaN : value;
};

export const dayStart = (date: string): string => new Date(`${date}T00:00:00`).toISOString();

export const dayEnd = (date: string): string => new Date(`${date}T23:59:59.999`).toISOString();

export type RangePreset = 'mes' | 'ultimos-12' | 'anio' | 'personalizado';

export const RANGE_PRESETS: readonly RangePreset[] = ['mes', 'ultimos-12', 'anio', 'personalizado'];

export const presetRange = (
  preset: Exclude<RangePreset, 'personalizado'>,
  now: Date,
): { from: string; to: string } => {
  const start = (year: number, month: number) => new Date(year, month, 1, 0, 0, 0, 0);
  const year = now.getFullYear();
  const month = now.getMonth();
  const from =
    preset === 'mes'
      ? start(year, month)
      : preset === 'anio'
        ? start(year, 0)
        : start(year, month - 11);
  return { from: from.toISOString(), to: now.toISOString() };
};

export const REVENUE_ROW_CAP = 20_000;

export const REJECTED_STATUSES: readonly string[] = ['DECLINED', 'VOIDED', 'ERROR'];

export const countOf = (
  byStatus: readonly { status: string; count: number }[],
  statuses: readonly string[],
): number =>
  byStatus
    .filter((entry) => statuses.includes(entry.status))
    .reduce((sum, entry) => sum + entry.count, 0);

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
