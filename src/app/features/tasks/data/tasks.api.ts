import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { errorStatusOf } from '../../../shared/http/error-code';
import { toParams } from '../../../shared/http/query-params';
import type { QueueItemsPage, QueueItemsQuery, QueueKey, QueueSummary } from './tasks.models';

const BASE = '/platform/tasks/queues';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

export const retryErrorKey = (error: unknown): string => {
  const status = errorStatusOf(error);
  if (status === 409) return 'task.retry.gone';
  if (status === 403) return 'task.retry.forbidden';
  return 'task.retry.failed';
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
}
