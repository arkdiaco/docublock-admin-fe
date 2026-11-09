import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type { ConsentReport, ConsentRequest } from './consents.models';

const BASE = '/platform/consents';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class ConsentsApi {
  private readonly http = inject(HttpClient);

  report(request: ConsentRequest, page: number, limit: number): Observable<ConsentReport> {
    return this.http.get<ConsentReport>(BASE, {
      params: toParams({ ...request, page, limit }),
      context: silent(),
    });
  }

  csv(request: ConsentRequest): Observable<ExportedFile> {
    return this.http
      .get(`${BASE}/export.csv`, {
        params: toParams({ ...request }),
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'tratamiento-datos.csv')));
  }
}
