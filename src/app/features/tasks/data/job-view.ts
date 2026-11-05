import type { OrgState } from '../../../shared/domain/org-state';
import type { JobResult, JobView } from './tasks.models';

const METRICS = new Set([
  'processed',
  'done',
  'failed',
  'scanned',
  'lapsed',
  'claimed',
  'retried',
  'reviewed',
  'sent',
  'skipped',
  'reminded',
  'escalated',
  'noticed',
  'queued',
  'resumed',
  'checked',
  'repaired',
  'users',
  'custody',
  'renotified',
  'requeued',
  'waiting',
]);

const RESULT_STATES: Record<JobResult, OrgState> = {
  ok: 'active',
  partial: 'warning',
  failed: 'suspended',
};

export interface JobStateView {
  state: OrgState;
  labelKey: string;
}

export interface JobMetricView {
  labelKey: string;
  value: number;
}

export const jobStateOf = (job: JobView): JobStateView => {
  if (job.running) return { state: 'trial', labelKey: 'task.job.state.running' };
  if (!job.enabled) return { state: 'closed', labelKey: 'task.job.state.off' };
  if (job.pause) return { state: 'warning', labelKey: 'task.job.state.paused' };
  if (!job.last) return { state: 'closed', labelKey: 'task.job.state.never' };
  return { state: RESULT_STATES[job.last.result], labelKey: `task.job.state.${job.last.result}` };
};

export const jobMetricsOf = (metrics: Record<string, number>): JobMetricView[] =>
  Object.entries(metrics)
    .filter(([key, value]) => METRICS.has(key) && value > 0)
    .map(([key, value]) => ({ labelKey: `task.job.metric.${key}`, value }));

export const durationOf = (ms: number): string => {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds % 60)} s`;
};
