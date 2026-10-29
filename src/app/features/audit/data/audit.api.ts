import { HttpClient, HttpContext } from '@angular/common/http';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type { AuditFacets, AuditFilters, AuditPage, AuditQuery } from './audit.models';

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);

  list(query: AuditQuery): Observable<AuditPage> {
    return this.http.get<AuditPage>('/platform/audit', { params: toParams(query) });
  }

  facets(): Observable<AuditFacets> {
    return this.http.get<AuditFacets>('/platform/audit/facets');
  }

  exportCsv(filters: AuditFilters): Observable<ExportedFile> {
    return this.http
      .get('/platform/audit/export.csv', {
        params: toParams(filters),
        responseType: 'blob',
        observe: 'response',
        context: new HttpContext().set(SILENT_ERRORS, true),
      })
      .pipe(map((response) => exportedFileOf(response, 'bitacora.csv')));
  }
}
