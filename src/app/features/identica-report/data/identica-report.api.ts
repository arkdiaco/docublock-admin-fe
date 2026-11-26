import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type {
  IdenticaExportRequest,
  IdenticaQueriesPage,
  IdenticaQueriesRequest,
  IdenticaReportRequest,
  IdenticaReportSummary,
} from './identica-report.models';

const BASE = '/platform/identica-report';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class IdenticaReportApi {
  private readonly http = inject(HttpClient);

  summary(request: IdenticaReportRequest): Observable<IdenticaReportSummary> {
    return this.http.get<IdenticaReportSummary>(`${BASE}/summary`, {
      params: toParams(request),
      context: silent(),
    });
  }

  queries(request: IdenticaQueriesRequest): Observable<IdenticaQueriesPage> {
    return this.http.get<IdenticaQueriesPage>(`${BASE}/queries`, {
      params: toParams(request),
      context: silent(),
    });
  }

  queriesCsv(request: IdenticaExportRequest): Observable<ExportedFile> {
    return this.http
      .get(`${BASE}/queries.csv`, {
        params: toParams(request),
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'consultas-identica.csv')));
  }
}
