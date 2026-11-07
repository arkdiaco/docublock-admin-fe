export const CODE_PURPOSES = [
  'login',
  'wallet_login',
  'signing',
  'massive_signing',
  'auto_sign',
] as const;
export type CodePurpose = (typeof CODE_PURPOSES)[number];

export const CODE_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type CodeChannel = (typeof CODE_CHANNELS)[number];

export const CODE_STATUSES = [
  'accepted',
  'sent',
  'delivered',
  'read',
  'undelivered',
  'failed',
] as const;
export type CodeDeliveryStatus = (typeof CODE_STATUSES)[number];

export type CodeDeliveryCounts = Record<CodeDeliveryStatus, number>;

export interface CodeDeliveryTotals {
  all: CodeDeliveryCounts;
  byChannel: Record<CodeChannel, CodeDeliveryCounts>;
}

export interface CodeDeliveryRow {
  id: string;
  purpose: CodePurpose;
  channel: CodeChannel;
  to: string;
  status: CodeDeliveryStatus;
  messageId?: string;
  error?: string;
  errorCode?: number;
  portal?: string;
  organizationId?: string;
  documentId?: string;
  userId?: string;
  signerId?: string;
  createdAt: string;
  statusAt: string;
  organizationName: string | null;
  documentName: string | null;
  personName: string | null;
}

export interface CodeDeliveryReport {
  total: number;
  page: number;
  limit: number;
  items: CodeDeliveryRow[];
  totals: CodeDeliveryTotals;
}

export interface CodeDeliveryFilters {
  purpose: CodePurpose | null;
  channel: CodeChannel | null;
  status: CodeDeliveryStatus | null;
  organizationId: string | null;
  document: string | null;
  period: string | null;
  page: number;
}

export interface CodeDeliveriesQuery {
  purpose: CodePurpose | null;
  channel: CodeChannel | null;
  status: CodeDeliveryStatus | null;
  organizationId: string | null;
  destination: string | null;
  document: string | null;
  from: string | null;
  page: number;
  limit: number;
}
