export const TRANSACTION_STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'sent', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type BillingFamily = 'active' | 'trial' | 'warning' | 'suspended' | 'closed';

export const TRANSACTION_FAMILY: Record<TransactionStatus, BillingFamily> = {
  PENDING: 'warning',
  APPROVED: 'active',
  DECLINED: 'suspended',
  VOIDED: 'closed',
  ERROR: 'suspended',
};

export const INVOICE_FAMILY: Record<InvoiceStatus, BillingFamily> = {
  draft: 'trial',
  sent: 'active',
  void: 'closed',
};

const isTransactionStatus = (status: string): status is TransactionStatus =>
  TRANSACTION_STATUSES.includes(status as TransactionStatus);

export const transactionStatusKey = (status: string): string =>
  `billing.txStatus.${isTransactionStatus(status) ? status : 'UNKNOWN'}`;

export const transactionFamilyOf = (status: string): BillingFamily =>
  isTransactionStatus(status) ? TRANSACTION_FAMILY[status] : 'closed';
