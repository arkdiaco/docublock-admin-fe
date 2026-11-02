import type { InvoiceStatus, TransactionStatus } from '../../../shared/domain/billing-status';

export const REVENUE_SOURCES = ['alohapay', 'stripe', 'manual', 'legacy', 'unknown'] as const;
export type RevenueSource = (typeof REVENUE_SOURCES)[number];

export const MANUAL_INTERVALS = ['monthly', 'annual', 'once'] as const;
export type ManualInterval = (typeof MANUAL_INTERVALS)[number];

export interface TransactionPromotion {
  code: string;
  discount: number;
}

export interface TransactionRow {
  id: string;
  idTransaction: string;
  alohapayId?: string;
  reference?: string;
  organizationId: string;
  organization: { id: string; name: string };
  plan: string;
  planName: string;
  planDuration: string;
  amountMajor: number;
  source: RevenueSource;
  taxes: unknown[];
  currency: string;
  status: TransactionStatus;
  invoiced?: boolean;
  documents?: number;
  paymentMethod?: string;
  promotionalCode?: TransactionPromotion;
  webhookEventIds: string[];
  requestDate: string;
  createdAt?: string;
}

export interface TransactionInvoiceRef {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
}

export interface TransactionDetail extends TransactionRow {
  liveStatus?: string;
  invoice: TransactionInvoiceRef | null;
}

export interface TransactionsPage {
  total: number;
  items: TransactionRow[];
}

export interface TransactionsQuery {
  search?: string;
  status?: TransactionStatus;
  organizationId?: string;
  invoiced?: boolean;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface TaxAmount {
  type: string;
  amount: number;
}

export interface ManualPaymentBody {
  organizationId: string;
  planCode: string;
  interval: ManualInterval;
  amount?: number;
  currency?: string;
  documents?: number;
  paymentMethod?: string;
  reference?: string;
  taxes?: TaxAmount[];
}

export interface ManualPlanOption {
  code: string;
  name: string;
  kind: 'SUBSCRIPTION' | 'PACKAGE';
  currency: string;
  priceMonthly: number;
  priceAnnual: number;
  priceOnce: number | null;
  limits: { documents: number | null };
}

export interface ReconcileResult {
  checked: number;
  repaired: { id: string; status: string }[];
  failed: { id: string; error: string }[];
}

export interface InvoiceItem {
  concept: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  organizationId?: string;
  transactionId?: string;
  externalRef?: string;
  clientName: string;
  clientTaxId?: string;
  clientEmail: string;
  clientAddress?: string;
  clientPhone?: string;
  currency: string;
  items: InvoiceItem[];
  subtotal?: number;
  taxes: TaxAmount[];
  total: number;
  notes?: string;
  status: InvoiceStatus;
  issueDate?: string;
  dueDate?: string;
  sentAt?: string;
  sentTo?: string;
  createdAt?: string;
}

export interface InvoicesPage {
  total: number;
  items: Invoice[];
}

export interface InvoicesQuery {
  search?: string;
  status?: InvoiceStatus;
  organizationId?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceBody {
  organizationId?: string;
  clientName?: string;
  clientTaxId?: string;
  clientEmail?: string;
  clientAddress?: string;
  clientPhone?: string;
  currency?: string;
  items: { concept: string; quantity: number; unitPrice: number }[];
  taxes: TaxAmount[];
  notes?: string;
  issueDate?: string;
  dueDate?: string;
}

interface Bucket {
  gross: number;
  count: number;
}

export interface RevenueSummary {
  capped: boolean;
  rowsRead: number;
  totals: ({ currency: string } & Bucket)[];
  byStatus: { status: string; count: number }[];
  byProvider: ({ source: RevenueSource; currency: string } & Bucket)[];
  byMonth: ({ year: number; month: number; currency: string } & Bucket)[];
  byPlan: ({ plan: string; name: string; currency: string } & Bucket)[];
  byOrganization: ({ organizationId: string; name: string; currency: string } & Bucket)[];
}

export interface RevenueRow {
  id: string;
  idTransaction: string;
  reference?: string;
  source: RevenueSource;
  status: string;
  amountMajor: number;
  currency: string;
  organization: { id: string; name: string };
  plan: { id: string; name: string };
  planDuration?: string;
  requestDate?: string;
  createdAt?: string;
}

export interface RevenuePage {
  total: number;
  items: RevenueRow[];
}

export interface RevenueFilter {
  from?: string;
  to?: string;
  search?: string;
  source?: RevenueSource;
  status?: string;
  organizationId?: string;
}

export interface RevenueQuery extends RevenueFilter {
  page?: number;
  limit?: number;
}

export interface GatewayConfigStatus {
  stripeConfigured: boolean;
  webhookSecretConfigured: boolean;
  forwardSigningConfigured: boolean;
  coreForwardTarget: boolean;
  alohapayConfigured: boolean;
  alohapayWebhookConfigured: boolean;
}

export type IssuerField = 'name' | 'taxId' | 'address' | 'email';

export interface PaymentConfigStatus {
  gateways: GatewayConfigStatus | null;
  issuerMissing: IssuerField[];
}
