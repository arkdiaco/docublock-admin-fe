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

export const JOB_KEYS = [
  'closing',
  'provisioning',
  'notifications',
  'massive',
  'purge',
  'campaigns',
  'seals',
  'endorsements',
  'deadlines',
  'signerReminders',
  'payments',
  'planReminders',
  'digestDaily',
  'digestWeekly',
] as const;
export type JobKey = (typeof JOB_KEYS)[number];

export type JobTrigger = 'schedule' | 'manual';
export type JobResult = 'ok' | 'partial' | 'failed';

export interface FinishedJobRun {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  trigger: JobTrigger;
  result: JobResult;
  metrics: Record<string, number>;
  error: string | null;
}

export interface JobView {
  key: JobKey;
  enabled: boolean;
  manual: boolean;
  running: { since: string; trigger: JobTrigger } | null;
  last: FinishedJobRun | null;
  lastFailure: { at: string; error: string } | null;
}
