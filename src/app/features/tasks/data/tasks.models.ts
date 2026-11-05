export const QUEUE_KEYS = [
  'closing',
  'provisioning',
  'notifications',
  'massive',
  'purge',
  'campaigns',
  'seals',
] as const;
export type QueueKey = (typeof QUEUE_KEYS)[number];

export const QUEUE_STATES = ['failed', 'pending', 'running'] as const;
export type QueueState = (typeof QUEUE_STATES)[number];

export type QueueCounts = Record<QueueState, number | null>;

export interface QueueSummary {
  key: QueueKey;
  counts: QueueCounts;
  oldestPendingAt: string | null;
}

export interface QueueItem {
  id: string;
  state: QueueState;
  organization: { id: string; name: string | null } | null;
  label: string | null;
  kind: string | null;
  attempts: number | null;
  error: string | null;
  nextAt: string | null;
  retryable: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface QueueItemsPage {
  key: QueueKey;
  state: QueueState;
  counts: QueueCounts;
  total: number;
  items: QueueItem[];
}

export interface QueueItemsQuery {
  state?: QueueState;
  page: number;
  limit: number;
}
