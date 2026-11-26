import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { toParams } from '../../../shared/http/query-params';
import type { IdenticaReportRequest, IdenticaReportSummary } from './identica-report.models';

@Injectable({ providedIn: 'root' })
export class IdenticaReportApi {
  private readonly http = inject(HttpClient);

  summary(request: IdenticaReportRequest): Observable<IdenticaReportSummary> {
    return this.http.get<IdenticaReportSummary>('/platform/identica-report/summary', {
      params: toParams(request),
      context: new HttpContext().set(SILENT_ERRORS, true),
    });
  }
}
