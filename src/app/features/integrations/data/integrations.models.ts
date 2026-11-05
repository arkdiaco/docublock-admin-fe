export const DELIVERY_STATUSES = ['pending', 'delivered', 'failed', 'exhausted'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type DeliveryContract = 'legacy' | 'v2';

export const DELIVERY_EVENTS = [
  'document.sent_for_signature',
  'document.signed',
  'document.fully_signed',
  'document.cancelled',
  'document.rejected',
  'document.lapsed',
  'document.anchored',
  'document.endorsement_requested',
  'document.endorsement_granted',
  'document.endorsement_completed',
  'document.endorsement_returned',
  'document.created',
  'document.sent',
  'signer.signed',
  'signer.rejected',
  'document.completed',
  'document.expired',
  'endorsement.requested',
  'endorsement.granted',
  'endorsement.completed',
  'endorsement.returned',
  'batch.completed',
  'title.issued',
  'title.custody',
  'title.endorsed',
  'title.filled',
  'title.settled',
  'title.materialized',
] as const;

export interface DeliveryRow {
  id: string;
  organizationId: string;
  organizationName: string | null;
  event: string;
  contract: DeliveryContract;
  documentId: string;
  status: DeliveryStatus;
  attempts: number;
  lastStatusCode?: number | null;
  lastError?: string | null;
  test?: boolean;
  createdAt: string;
}

export interface DeliveriesPage {
  data: DeliveryRow[];
  nextCursor: string | null;
}

export interface DeliveriesQuery {
  organizationId?: string | null;
  event?: string | null;
  status?: DeliveryStatus | null;
  from?: string | null;
  cursor?: string | null;
  limit: number;
}

export interface OpenDeliveryCounts {
  pending: number;
  failed: number;
  exhausted: number;
}

export interface DeliveryDetail extends DeliveryRow {
  destinationUrl: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  lastSentAt: string | null;
  payload: Record<string, unknown>;
}

export interface ReplayResult {
  deliveryId: string;
  delivered: boolean;
  statusCode?: number;
  error?: string;
  exhausted: boolean;
  delivery: DeliveryDetail;
}
