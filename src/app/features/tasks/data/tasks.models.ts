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

export const MAINTENANCE_TASK_KEYS = [
  'verifyIndexes',
  'seedSystemRoles',
  'syncRolePermissions',
  'grantDerivedPermissions',
] as const;
export type MaintenanceTaskKey = (typeof MAINTENANCE_TASK_KEYS)[number];

export type MaintenanceMode = 'rehearsal' | 'execution';
export type MaintenanceRunState = 'running' | 'ok' | 'partial' | 'failed' | 'interrupted';
export type MaintenanceItemState = 'pending' | 'done' | 'failed' | 'info';

export interface MaintenanceItem {
  label: string;
  detail: string | null;
  state: MaintenanceItemState;
}

export interface MaintenanceRun {
  id: string;
  task: MaintenanceTaskKey;
  mode: MaintenanceMode;
  state: MaintenanceRunState;
  adminId: string;
  admin: { id: string; name: string } | null;
  reason: string | null;
  rehearsalId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  scanned: number;
  pending: number;
  changed: number;
  failed: number;
  items: MaintenanceItem[];
  itemsTruncated: boolean;
  error: string | null;
}

export interface MaintenanceTaskView {
  key: MaintenanceTaskKey;
  running: boolean;
  lastRehearsal: MaintenanceRun | null;
  lastExecution: MaintenanceRun | null;
  validRehearsalId: string | null;
}

export interface MaintenanceRunsPage {
  total: number;
  items: MaintenanceRun[];
}

export interface MaintenanceStarted {
  id: string;
  key: MaintenanceTaskKey;
  state: 'running';
}
