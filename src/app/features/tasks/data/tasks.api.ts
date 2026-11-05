import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { QueueItemsPage, QueueItemsQuery, QueueKey, QueueSummary } from './tasks.models';

const BASE = '/platform/tasks/queues';
const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

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
}
