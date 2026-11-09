import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type { ConsumptionReport, DetailRequest, ValidationDetail } from './consumption.models';

const BASE = '/platform/validation-credits';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

@Injectable({ providedIn: 'root' })
export class ConsumptionApi {
  private readonly http = inject(HttpClient);

  report(range: { from?: string; to?: string }): Observable<ConsumptionReport> {
    return this.http.get<ConsumptionReport>(`${BASE}/report`, {
      params: toParams(range),
    });
  }

  detail(request: DetailRequest, page: number, limit: number): Observable<ValidationDetail> {
    return this.http.get<ValidationDetail>(`${BASE}/detail`, {
      params: toParams({ ...request, page, limit }),
      context: silent(),
    });
  }

  detailCsv(request: DetailRequest): Observable<ExportedFile> {
    return this.http
      .get(`${BASE}/detail.csv`, {
        params: toParams({ ...request }),
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'consumo-validaciones.csv')));
  }

  detailPdf(request: DetailRequest): Observable<ExportedFile> {
    return this.http
      .post(`${BASE}/detail/pdf`, request, {
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'detalle-validaciones.pdf')));
  }
}
