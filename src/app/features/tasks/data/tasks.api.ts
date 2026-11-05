import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorCodeOf, errorStatusOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type {
  JobKey,
  JobView,
  MaintenanceRun,
  MaintenanceRunsPage,
  MaintenanceStarted,
  MaintenanceTaskKey,
  MaintenanceTaskView,
  QueueItemsPage,
  QueueItemsQuery,
  QueueKey,
  QueueSummary,
} from './tasks.models';

const BASE = '/platform/tasks/queues';
const JOBS = '/platform/tasks/jobs';
const MAINTENANCE = '/platform/tasks/maintenance';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const retryErrorKey = (error: unknown): string => {
  const status = errorStatusOf(error);
  if (status === 409) return 'task.retry.gone';
  if (status === 403) return 'task.retry.forbidden';
  return 'task.retry.failed';
};

export const runJobErrorKey = (error: unknown): string => {
  const status = errorStatusOf(error);
  if (status === 409) return 'task.job.run.busy';
  if (status === 403) return 'task.job.run.forbidden';
  return 'task.job.run.failed';
};

export const maintenanceErrorKey = (error: unknown): string => {
  const code = errorCodeOf(error);
  if (code === 'ENSAYO_REQUERIDO') return 'task.mnt.error.rehearsalRequired';
  if (code === 'TAREA_EN_CURSO') return 'task.mnt.error.busy';
  if (errorStatusOf(error) === 403) return 'task.mnt.error.forbidden';
  return 'task.mnt.error.failed';
};

@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly http = inject(HttpClient);

  queues(): Observable<{ queues: QueueSummary[] }> {
    return this.http.get<{ queues: QueueSummary[] }>(BASE, { context: silent() });
  }

  items(queue: QueueKey, query: QueueItemsQuery): Observable<QueueItemsPage> {
    return this.http.get<QueueItemsPage>(`${BASE}/${queue}/items`, {
      params: toParams({ ...query }),
      context: silent(),
    });
  }

  retry(queue: QueueKey, id: string, reason: string): Observable<{ id: string; state: 'pending' }> {
    return this.http.post<{ id: string; state: 'pending' }>(
      `${BASE}/${queue}/items/${id}/retry`,
      { reason },
      { context: silent() },
    );
  }

  jobs(): Observable<{ jobs: JobView[] }> {
    return this.http.get<{ jobs: JobView[] }>(JOBS, { context: silent() });
  }

  runJob(key: JobKey, reason: string): Observable<{ key: JobKey; state: 'running' }> {
    return this.http.post<{ key: JobKey; state: 'running' }>(
      `${JOBS}/${key}/run`,
      { reason },
      { context: silent() },
    );
  }

  maintenanceTasks(): Observable<{ tasks: MaintenanceTaskView[] }> {
    return this.http.get<{ tasks: MaintenanceTaskView[] }>(MAINTENANCE, { context: silent() });
  }

  maintenanceRuns(query: { page: number; limit: number }): Observable<MaintenanceRunsPage> {
    return this.http.get<MaintenanceRunsPage>(`${MAINTENANCE}/runs`, {
      params: toParams({ ...query }),
      context: silent(),
    });
  }

  maintenanceRun(id: string): Observable<MaintenanceRun> {
    return this.http.get<MaintenanceRun>(`${MAINTENANCE}/runs/${id}`, { context: silent() });
  }

  rehearse(key: MaintenanceTaskKey): Observable<MaintenanceStarted> {
    return this.http.post<MaintenanceStarted>(`${MAINTENANCE}/${key}/rehearse`, {}, { context: silent() });
  }

  execute(key: MaintenanceTaskKey, reason: string, rehearsalId: string): Observable<MaintenanceStarted> {
    return this.http.post<MaintenanceStarted>(
      `${MAINTENANCE}/${key}/execute`,
      { reason, rehearsalId },
      { context: silent() },
    );
  }
}
