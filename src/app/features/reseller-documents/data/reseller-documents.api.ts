import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SILENT_ERRORS } from '../../../core/http/http.interceptors';
import { exportedFileOf, type ExportedFile } from '../../../shared/http/exported-file';
import { toParams } from '../../../shared/http/query-params';
import type { SignedDocumentsReport, SignedDocumentsRequest } from './reseller-documents.models';

const silent = (): HttpContext => new HttpContext().set(SILENT_ERRORS, true);

const base = (resellerId: string): string =>
  `/platform/resellers/${encodeURIComponent(resellerId)}/signed-documents`;

@Injectable({ providedIn: 'root' })
export class ResellerDocumentsApi {
  private readonly http = inject(HttpClient);

  report(
    resellerId: string,
    request: SignedDocumentsRequest,
    page: number,
    limit: number,
  ): Observable<SignedDocumentsReport> {
    return this.http.get<SignedDocumentsReport>(base(resellerId), {
      params: toParams({ ...request, page, limit }),
      context: silent(),
    });
  }

  csv(resellerId: string, request: SignedDocumentsRequest): Observable<ExportedFile> {
    return this.http
      .get(`${base(resellerId)}.csv`, {
        params: toParams({ ...request }),
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'documentos-firmados.csv')));
  }

  pdf(resellerId: string, request: SignedDocumentsRequest): Observable<ExportedFile> {
    return this.http
      .post(`${base(resellerId)}/pdf`, request, {
        responseType: 'blob',
        observe: 'response',
        context: silent(),
      })
      .pipe(map((response) => exportedFileOf(response, 'documentos-firmados.pdf')));
  }
}
