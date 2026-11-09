import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type {
  HistoryRequest,
  HistorySignersPage,
  ValidationHistory,
} from './validation-history.models';

const BASE = '/platform/validation-credits/history';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class ValidationHistoryApi {
  private readonly http = inject(HttpClient);

  report(request: HistoryRequest): Observable<ValidationHistory> {
    return this.http.get<ValidationHistory>(BASE, {
      params: toParams({ ...request }),
      context: silent(),
    });
  }

  signers(
    request: HistoryRequest,
    node: string,
    search: string,
    page: number,
    limit: number,
  ): Observable<HistorySignersPage> {
    return this.http.get<HistorySignersPage>(`${BASE}/signers`, {
      params: toParams({ ...request, node, search: search.trim() || undefined, page, limit }),
      context: silent(),
    });
  }

  csv(request: HistoryRequest): Observable<ExportedFile> {
    return this.http
      .get(`${BASE}.csv`, {
        params: toParams({ ...request }),
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'historico-validaciones.csv')));
  }

  pdf(request: HistoryRequest): Observable<ExportedFile> {
    return this.http
      .post(`${BASE}/pdf`, request, {
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'historico-validaciones.pdf')));
  }
}
