import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type {
  ErrorGroupDetail,
  ErrorGroupReport,
  ErrorGroupRow,
  ErrorGroupState,
  ErrorLogsQuery,
} from './error-logs.models';

const BASE = '/platform/error-logs';

@Injectable({ providedIn: 'root' })
export class ErrorLogsApi {
  private readonly http = inject(HttpClient);

  list(query: ErrorLogsQuery): Observable<ErrorGroupReport> {
    return this.http.get<ErrorGroupReport>(BASE, {
      params: toParams({ ...query }),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }

  detail(id: string): Observable<ErrorGroupDetail> {
    return this.http.get<ErrorGroupDetail>(`${BASE}/${encodeURIComponent(id)}`, {
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }

  changeState(id: string, state: ErrorGroupState, reason: string): Observable<ErrorGroupRow> {
    return this.http.post<ErrorGroupRow>(
      `${BASE}/${encodeURIComponent(id)}/state`,
      { state, reason },
      { context: new HttpContext().set(SILENT_ERRORS, true) },
    );
  }
}
