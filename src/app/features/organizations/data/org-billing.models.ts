import type { InvoiceStatus } from '../../../shared/domain/billing-status';

export interface OrgTransactionRow {
  id: string;
  idTransaction: string;
  reference?: string;
  planName: string;
  amountMajor: number;
  currency: string;
  status: string;
  requestDate?: string;
  createdAt?: string;
}

export interface OrgInvoiceRow {
  id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issueDate?: string;
}

export interface OrgBillingPage<T> {
  total: number;
  items: T[];
}
