import type { OrgState } from '../../../shared/domain/org-state';
import type {
  MaintenanceItemState,
  MaintenanceRun,
  MaintenanceRunState,
  MaintenanceTaskView,
} from './tasks.models';

export interface MaintenanceStateView {
  state: OrgState;
  labelKey: string;
}

const RUN_STATES: Record<MaintenanceRunState, OrgState> = {
  running: 'trial',
  ok: 'active',
  partial: 'warning',
  failed: 'suspended',
  interrupted: 'warning',
};

const ITEM_STATES: Record<MaintenanceItemState, OrgState> = {
  pending: 'warning',
  done: 'active',
  failed: 'suspended',
  info: 'trial',
};

const timeOf = (run: MaintenanceRun | null): number => (run ? new Date(run.startedAt).getTime() : 0);

export const runStateOf = (run: MaintenanceRun): MaintenanceStateView => ({
  state: RUN_STATES[run.state],
  labelKey: `task.mnt.state.${run.state}`,
});

export const itemStateOf = (state: MaintenanceItemState): MaintenanceStateView => ({
  state: ITEM_STATES[state],
  labelKey: `task.mnt.item.${state}`,
});

export const taskStateOf = (task: MaintenanceTaskView): MaintenanceStateView => {
  if (task.running) return { state: 'trial', labelKey: 'task.mnt.state.running' };
  const { lastRehearsal: rehearsal, lastExecution: execution } = task;
  const latest = timeOf(execution) > timeOf(rehearsal) ? execution : rehearsal;
  if (!latest) return { state: 'closed', labelKey: 'task.mnt.state.never' };
  if (latest.state !== 'ok') return runStateOf(latest);
  if (latest.mode === 'rehearsal' && latest.pending > 0) {
    return { state: 'warning', labelKey: 'task.mnt.state.pendingWork' };
  }
  return { state: 'active', labelKey: 'task.mnt.state.upToDate' };
};

export const canExecute = (task: MaintenanceTaskView): boolean =>
  task.validRehearsalId !== null && (task.lastRehearsal?.pending ?? 0) > 0;

export const rehearsalNoteKey = (task: MaintenanceTaskView): string => {
  const rehearsal = task.lastRehearsal;
  if (!rehearsal) return 'task.mnt.note.none';
  if (rehearsal.state === 'running') return 'task.mnt.note.running';
  if (rehearsal.state === 'failed' || rehearsal.state === 'interrupted') return 'task.mnt.note.failed';
  if (!task.validRehearsalId) return timeOf(task.lastExecution) >= timeOf(rehearsal) ? 'task.mnt.note.used' : 'task.mnt.note.expired';
  return rehearsal.pending > 0 ? 'task.mnt.note.valid' : 'task.mnt.note.nothing';
};

export const runRowsKey = (run: MaintenanceRun): { key: string; count: number } =>
  run.mode === 'rehearsal'
    ? { key: 'task.mnt.rows.pending', count: run.pending }
    : { key: 'task.mnt.rows.changed', count: run.changed };
