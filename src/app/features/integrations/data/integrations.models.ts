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

export type RetryableStatus = 'failed' | 'exhausted';

export interface RetryFilter {
  organizationId?: string | null;
  event?: string | null;
  status?: RetryableStatus | null;
  from?: string | null;
}

export interface RetryPreview {
  failed: number;
  exhausted: number;
  oldestAt: string | null;
  limit: number;
}

export interface RetryOutcome {
  taken: number;
  remaining: number;
}

export const KEY_FILTERS = ['expiring', 'unused', 'expired', 'revoked'] as const;
export type KeyFilter = (typeof KEY_FILTERS)[number];
export type KeyState = 'active' | 'rotating' | 'revoked' | 'expired';

export interface KeyRow {
  id: string;
  organizationId: string;
  organizationName: string | null;
  name: string;
  prefix: string;
  scopes: string[];
  state: KeyState;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface KeysPage {
  data: KeyRow[];
  nextCursor: string | null;
}

export interface KeysQuery {
  organizationId?: string | null;
  filter?: KeyFilter | null;
  cursor?: string | null;
  limit: number;
}

export interface KeyCounts {
  expiring: number;
  unused: number;
  expired: number;
}

export interface EndpointRow {
  id: string;
  organizationId: string;
  organizationName: string | null;
  url: string;
  description?: string;
  events: string[];
  enabled: boolean;
  secretRotatedAt?: string;
  createdAt: string;
  recentFailures: number;
  lastFailureAt: string | null;
  lastError: string | null;
}

export interface EndpointsPage {
  data: EndpointRow[];
  nextCursor: string | null;
}

export interface EndpointsQuery {
  organizationId?: string | null;
  enabled?: boolean | null;
  cursor?: string | null;
  limit: number;
}
